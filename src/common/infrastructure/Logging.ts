import {Level, Logger, StreamEntry} from 'pino';

export type AdditionalLevels = "verbose" | "log";
export type AllLevels = Level | AdditionalLevels;
export type LogLevel = AllLevels;
export const logLevels: LogLevel[] = ['fatal', 'error', 'warn', 'info', 'verbose', 'debug'];

export interface LogConfig {
    level?: string
    file?: string | false
    console?: string
}

export interface LogOptions {
    /**
     *  Specify the minimum log level for all log outputs without their own level specified.
     *
     *  Defaults to env `LOG_LEVEL` or `info` if not specified.
     *
     *  @default 'info'
     * */
    level?: LogLevel
    /**
     * Specify the minimum log level to output to rotating files. If `false` no log files will be created.
     * */
    file?: LogLevel | false
    /**
     * Specify the minimum log level streamed to the console (or docker container)
     * */
    console?: LogLevel
}

export const asLogOptions = (obj: LogConfig = {}): obj is LogOptions => {
    return Object.entries(obj).every(([key, val]) => {
        if (key !== 'file') {
            return val === undefined || logLevels.includes(val.toLocaleLowerCase());
        }
        return val === undefined || val === false || logLevels.includes(val.toLocaleLowerCase());
    });
}

export type LabelledLogger = Logger<AllLevels> & {
    labels?: any[]
    addLabel: (value: any) => void
}

export type AllLevelStreamEntry = StreamEntry<AllLevels>
