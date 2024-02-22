import dayjs, {Dayjs} from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import isBetween from 'dayjs/plugin/isBetween.js';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import duration from 'dayjs/plugin/duration.js';
import timezone from 'dayjs/plugin/timezone.js';
import path from "path";
import {projectDir} from "./common/index.js";
import {AppLogger, appPinoLogger, initPinoLogger} from "./common/logging.js";
import {ErrorWithCause} from "pony-cause";
import {parseConfigFromSources} from "./common/config/ConfigBuilder.js";
import {Notifiers} from "./notifier/Notifiers.js";
import {EndlessFileParser} from "./EndlessFileParser.js";
import {pEvent} from "p-event";
import {GeoQueue} from "./GeoQueue.js";
import {LRUCache} from "lru-cache";
import {EndlessLogStats, EndlessStatLog} from "./common/infrastructure/Atomic.js";
import {endlessLogLineToFriendly} from "./utils/index.js";

dayjs.extend(utc)
dayjs.extend(isBetween);
dayjs.extend(relativeTime);
dayjs.extend(duration);
dayjs.extend(timezone);

const initLogger = initPinoLogger; // getLogger({file: false}, 'init');

let logger: AppLogger;

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

        logger = await appPinoLogger(logging);

        const statsCache = new LRUCache<string, EndlessLogStats>({max: 1000});

        const notifiers = new Notifiers(logger, config.mapquestKey);
        await notifiers.buildWebhooks(config.notifiers);

        const geoQueue = new GeoQueue(logger);
        geoQueue.on('log', async (log) => {
            await notifiers.push(log);
        });

        try {
            const parser = await EndlessFileParser.fromFile(config.endlessDir, logger);
            parser.on('error', (err) => {
                throw err;
            });
            parser.on('line', async (line) => {
                const stats = statsCache.get(line.host.address) ?? {
                    firstSeen: line.time,
                    connections: 0,
                    time: dayjs.duration(0)
                };
                if ('duration' in line) {
                    stats.time = stats.time.add(line.duration)
                }
                if (line.type === 'accept' || stats.connections === 0) {
                    stats.connections++;
                }
                statsCache.set(line.host.address, stats);
                const statLog: EndlessStatLog = {...line,stats};
                parser.logger.verbose(`Parsed => ${endlessLogLineToFriendly(statLog)}`);
                await geoQueue.push(statLog);
            });
            await parser.start();
            await pEvent(parser, 'close');
        } catch (e) {
            throw e;
        }
    } catch (e) {
        initLogger.error('Exited with uncaught error');
        initLogger.error(e);
        process.kill(process.pid, 'SIGTERM');
    }
})();
