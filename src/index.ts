import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import isBetween from 'dayjs/plugin/isBetween.js';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import duration from 'dayjs/plugin/duration.js';
import timezone from 'dayjs/plugin/timezone.js';
import path from "path";
import {projectDir} from "./common/index.js";
import {Logger} from "@foxxmd/winston";
import {getLogger} from "./common/logging.js";
import {ErrorWithCause} from "pony-cause";
import {parseConfigFromSources} from "./common/config/ConfigBuilder.js";
import {Notifiers} from "./notifier/Notifiers.js";
import {EndlessFileParser} from "./EndlessFileParser.js";
import {EndlessLog, EndlessLogLine, IPDataFields} from "./common/infrastructure/Atomic.js";
import {GeoLookup} from "./GeoLookup.js";
import {sleep} from "./utils/index.js";

dayjs.extend(utc)
dayjs.extend(isBetween);
dayjs.extend(relativeTime);
dayjs.extend(duration);
dayjs.extend(timezone);

const initLogger = getLogger({file: false}, 'init');

let logger: Logger;

process.on('uncaughtExceptionMonitor', (err, origin) => {
    const appError = new ErrorWithCause(`Uncaught exception is crashing the app! :( Type: ${origin}`, {cause: err});
    if (logger !== undefined) {
        logger.error(appError)
    } else {
        initLogger.error(appError);
    }
})

const configDir = process.env.CONFIG_DIR || path.resolve(projectDir, `./config`);

(async function () {
    try {

        initLogger.debug(`Config Dir ENV: ${process.env.CONFIG_DIR} -> Resolved: ${configDir}`)
        const config = await parseConfigFromSources(configDir);
        initLogger.debug(`Endless Dir ENV: ${process.env.ENDLESS_DIR} -> Resolved: ${config.endlessDir}`)
        const {
            logging = {},
        } = config;

        logger = getLogger(logging);

        const notifiers = new Notifiers(logger, config.mapquestKey);
        await notifiers.buildWebhooks(config.notifiers);

        const lookup = new GeoLookup(logger);

        const logLinesQueue: EndlessLogLine[] = [];
        const endlessLogQueue: EndlessLog[] = [];

        const processLineQueue = async () => {
            while (true) {
                if (logLinesQueue.length > 0) {
                    const line = logLinesQueue.shift();
                    let geo: IPDataFields | undefined;
                    try {
                        geo = await lookup.getInfo(line.host);
                    } catch (e) {
                        logger.warn(e);
                    }
                    endlessLogQueue.push({...line, geo});
                }
                await sleep(1500);
            }
        }

        const processEndlessLog = async () => {
            while (true) {
                if (endlessLogQueue.length > 0) {
                    const log = endlessLogQueue.shift();
                    const anySent = await notifiers.notify({log, priority: 'info'});
                    if (anySent) {
                        await sleep(3000);
                    } else {
                        await sleep(1000);
                    }
                } else {
                    await sleep(1000);
                }
            }
        }

        try {
            const parser = await EndlessFileParser.fromFile(config.endlessDir, logger);
            parser.on('error', (err) => {
                throw err;
            });
            parser.on('line', async (line: EndlessLogLine) => {
                if (line.type === 'accept') {
                    logLinesQueue.push(line);
                }
            });
            processLineQueue();
            processEndlessLog()
            await parser.start();
        } catch (e) {
            throw e;
        }

        const f = 1;
    } catch (e) {
        initLogger.error('Exited with uncaught error');
        initLogger.error(e);
        process.kill(process.pid, 'SIGTERM');
    }
})();
