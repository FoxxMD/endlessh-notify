import path from "path";
import {configDir} from "./index.js";
import process from "process";
import {ErrorWithCause} from "pony-cause";
import dayjs from "dayjs";
import {fileOrDirectoryIsWriteable} from "../utils/io.js";
import {
    AllLevelStreamEntry,
    asLogOptions,
    LabelledLogger,
    LogConfig,
    LogLevel,
    LogOptions
} from "./infrastructure/Logging.js";
import {
    pino,
    LevelWithSilentOrString,
} from 'pino';
import pRoll from 'pino-roll';
import prettyDef, {PrettyOptions, PinoPretty, colorizerFactory} from 'pino-pretty';
import {createColors} from 'colorette';
import * as Colorette from "colorette";

export let logPath = path.resolve(configDir, `./logs`);
if (typeof process.env.CONFIG_DIR === 'string') {
    logPath = path.resolve(process.env.CONFIG_DIR, './logs');
}

export type AppLogger = LabelledLogger

const CWD = process.cwd();
const prettyOptsFactory = (opts: PrettyOptions = {}) => {
    const {colorize} = opts;
    const colorizeOpts: undefined | {useColor: boolean} = colorize === undefined ? undefined : {useColor: colorize};
    const colors = createColors(colorizeOpts)

    return {
        ...prettyCommon(colors),
        ...opts
    }
}

const prettyCommon = (colors: Colorette.Colorette): PrettyOptions => {
    return {
        messageFormat: (log, messageKey) => {
            const labels: string[] = log.labels as string[] ?? [];
            const leaf = log.leaf as string | undefined;
            const nodes = labels;
            if (leaf !== null && leaf !== undefined && !nodes.includes(leaf)) {
                nodes.push(leaf);
            }
            const labelContent = nodes.length === 0 ? '' : `${nodes.map((x: string) => colors.blackBright(`[${x}]`)).join(' ')} `;
            const msg = log[messageKey];
            const stackTrace = log.err !== undefined ? `\n${(log.err as any).stack.replace(CWD, 'CWD')}` : '';
            return `${labelContent}${msg}${stackTrace}`;
        },
        hideObject: false,
        ignore: 'pid,hostname,labels,err',
        translateTime: 'SYS:standard',
        customLevels: {
            verbose: 25,
            log: 21,
        },
        customColors: 'verbose:magenta,log:greenBright',
        colorizeObjects: true,
        // @ts-ignore
        useOnlyCustomProps: false,
    }
}

const prettyConsole: PrettyOptions = prettyOptsFactory()
const prettyFile: PrettyOptions = prettyOptsFactory({
    colorize: false,
});

const buildParsedLogOptions = (config: LogConfig = {}): Required<LogOptions> => {
    if (!asLogOptions(config)) {
        throw new Error(`Logging levels were not valid. Must be one of: 'error', 'warn', 'info', 'verbose', 'debug', 'silent' -- 'file' may be false.`)
    }

    const {level: configLevel} = config;
    const envLevel = process.env.LOG_LEVEL as LogLevel | undefined;
    const defaultLevel = envLevel ?? 'info';
    const {
        level = configLevel || defaultLevel,
        file = configLevel || defaultLevel,
        console = configLevel || 'debug'
    } = config;

    return {
        level,
        file: file as LogLevel | false,
        console
    };
}

const buildPinoFileStream = async (options: Required<LogOptions>): Promise<AllLevelStreamEntry | undefined> => {
    const {file} = options;
    if(file === false) {
        return undefined;
    }

    try {
        fileOrDirectoryIsWriteable(logPath);
        const rollingDest = await pRoll({
            file: path.resolve(logPath, 'app'),
            size: 10,
            frequency: 'daily',
            get extension() {return `-${dayjs().format('YYYY-MM-DD')}.log`},
            mkdir: true,
            sync: false,
        });

        return {
            level: file as LogLevel,
            stream: prettyDef.default({...prettyFile, destination: rollingDest})
        };
    } catch (e: any) {
        throw new ErrorWithCause<Error>('WILL NOT write logs to rotating file due to an error while trying to access the specified logging directory', {cause: e as Error});
    }
}

const buildPinoConsoleStream = (options: Required<LogOptions>): AllLevelStreamEntry => {
    return {
        level: options.console as LogLevel,
        stream: prettyDef.default({...prettyConsole, destination: 1, sync: true})
    }
}

const buildPinoLogger = (defaultLevel: LevelWithSilentOrString, streams: AllLevelStreamEntry[]): LabelledLogger => {
    const plogger = pino({
        // @ts-ignore
        mixin: (obj, num, loggerThis) => {
            return {
                labels: loggerThis.labels ?? []
            }
        },
        level: defaultLevel,
        customLevels: {
            verbose: 25,
            log: 21
        },
        useOnlyCustomLevels: false,
    }, pino.multistream(streams)) as LabelledLogger;

    plogger.addLabel = function (value) {
        if (this.labels === undefined) {
            this.labels = [];
        }
        this.labels.push(value)
    }
    return plogger;
}

export const testPinoLogger = buildPinoLogger('silent', [buildPinoConsoleStream(buildParsedLogOptions({level: 'debug'}))]);

export const initPinoLogger = buildPinoLogger('debug', [buildPinoConsoleStream(buildParsedLogOptions({level: 'debug'}))]);

export const appPinoLogger = async (config: LogConfig = {}, name = 'App') => {
    const options = buildParsedLogOptions(config);
    const stream = buildPinoConsoleStream(options);
    const file = await buildPinoFileStream(options);
    return buildPinoLogger('debug' as LevelWithSilentOrString, [stream, file]);
}

export const createChildPinoLogger = (parent: LabelledLogger, labelsVal: any | any[] = [], context: object = {}, options = {}) => {
    const newChild = parent.child(context, options) as LabelledLogger;
    const labels = Array.isArray(labelsVal) ? labelsVal : [labelsVal];
    newChild.labels = [...[...(parent.labels ?? [])], ...labels];
    newChild.addLabel = function (value) {
        if(this.labels === undefined) {
            this.labels = [];
        }
        this.labels.push(value);
    }
    return newChild
}
export const createChildLogger = (logger: AppLogger, labelsVal: any | any[] = []): AppLogger => {
    const labels = Array.isArray(labelsVal) ? labelsVal : [labelsVal];
    return createChildPinoLogger(logger as LabelledLogger, labels);
}
