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

dayjs.extend(utc)
dayjs.extend(isBetween);
dayjs.extend(relativeTime);
dayjs.extend(duration);
dayjs.extend(timezone);

const initLogger = getLogger({file: false}, 'init');

let logger: Logger;

process.on('uncaughtExceptionMonitor', (err, origin) => {
    const appError = new ErrorWithCause(`Uncaught exception is crashing the app! :( Type: ${origin}`, {cause: err});
    if(logger !== undefined) {
        logger.error(appError)
    } else {
        initLogger.error(appError);
    }
})

const configDir = process.env.CONFIG_DIR || path.resolve(projectDir, `./config`);
const endlessDir = process.env.ENDLESS_DIR || path.resolve(projectDir, `./endlessData`);

(async function () {
    try {

        initLogger.debug(`Config Dir ENV: ${process.env.CONFIG_DIR} -> Resolved: ${configDir}`)
        const config = await parseConfigFromSources(configDir);
        initLogger.debug(`Endless Dir ENV: ${process.env.ENDLESS_DIR} -> Resolved: ${config.endlessDir}`)
        const {
            logging = {},
        } = config;

        logger = getLogger(logging);


    } catch (e) {
        logger.error('Exited with uncaught error');
        logger.error(e);
        process.kill(process.pid, 'SIGTERM');
    }
})();
