import {MESSAGE} from 'triple-beam';
import {Dayjs} from "dayjs";
import {Address4, Address6} from "ip-address";
import {Duration} from "dayjs/plugin/duration.js";
export type LogLevel = "error" | "warn" | "safety" | "info" | "verbose" | "debug";
export const logLevels = ['error', 'warn', 'info', 'verbose', 'debug'];

export type ConfigFormat = 'yaml';

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

    db?: boolean
}

export const asLogOptions = (obj: LogConfig = {}): obj is LogOptions => {
    return Object.entries(obj).every(([key,  val]) => {
        if(key !== 'file') {
            return val === undefined || logLevels.includes(val.toLocaleLowerCase());
        }
        return val === undefined || val === false || logLevels.includes(val.toLocaleLowerCase());
    });
}

export interface LogInfo extends LogInfoMeta {
    message: string
    [MESSAGE]: string,
    level: string
    timestamp: string
    transport?: string[]
    stack?: string
}

export interface LogInfoMeta {
    labels?: string[]
    [key: string]: any
}

export interface NamedGroup {
    [name: string]: any
}

export interface RegExResult {
    match: string,
    groups: string[],
    index: number
    named: NamedGroup
}
export interface numberFormatOptions {
    toFixed: number,
    defaultVal?: any,
    prefix?: string,
    suffix?: string,
    round?: {
        type?: string,
        enable: boolean,
        indicate?: boolean,
    }
}

/**
 * A shorthand value for a DayJS duration consisting of a number value and time unit
 *
 * * EX `9 days`
 * * EX `3 months`
 * @pattern ^\s*(?<time>\d+)\s*(?<unit>days?|weeks?|months?|years?|hours?|minutes?|seconds?|milliseconds?)\s*$
 * */
export type DayJSShorthand = string;
/**
 * An ISO 8601 Duration
 * @pattern ^(-?)P(?=\d|T\d)(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)([DW]))?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$
 * */
export type ISO8601 = string;
export type DurationString = DayJSShorthand | ISO8601;

export interface RegExResult {
    match: string,
    groups: string[],
    index: number
    named: NamedGroup
}

export type IPAddress = Address4 | Address6;

export interface EndlessLogLineBase {
    type: 'accept' | 'close'
    time: Dayjs
    host: IPAddress
}

export interface EndlessAcceptLogLine extends EndlessLogLineBase {
    type: 'accept'
}

export interface EndlessCloseLogLine extends EndlessLogLineBase {
    type: 'close'
    duration: Duration
}

export type EndlessLogLine = EndlessAcceptLogLine | EndlessCloseLogLine;

export const isEndlessAccept = (line: EndlessLogLineBase): line is EndlessAcceptLogLine => {
    return line.type === 'accept';
}

export const isEndlessClose = (line: EndlessLogLineBase): line is EndlessCloseLogLine => {
    return line.type === 'close';
}

/**
 * @example 2024-02-09 17:32:27.585995618  2024-02-09T22:32:27.585Z ACCEPT host=::ffff:127.0.0.1 port=52066 fd=4 n=1/50
 * */
export type EndlesshAcceptLineStr = string;
/**
 * @example 2024-02-09 17:32:47.600712623  2024-02-09T22:32:47.600Z CLOSE host=::ffff:127.0.0.1 port=52066 fd=4 time=20.015 bytes=9
 * */
export type EndlesshCloseLineStr = string;
export type EndlesshLineStr = EndlesshAcceptLineStr | EndlesshCloseLineStr;

/**
 * @example I0201 18:19:05.059194       1 client.go:58] ACCEPT host=141.98.11.11 port=46374 n=1/4096
 * */
export type EndlesshGoAcceptLineStr = string;
/**
 * @example I0201 18:19:33.074002       1 client.go:99] CLOSE host=141.98.11.11 port=46374 time=28.014545892 bytes=449
 * */
export type EndlesshGoCloseLineStr = string;
export type EndlesshGoLineStr = EndlesshGoAcceptLineStr | EndlesshGoCloseLineStr;

export interface numberFormatOptions {
    toFixed: number,
    defaultVal?: any,
    prefix?: string,
    suffix?: string,
    round?: {
        type?: string,
        enable: boolean,
        indicate?: boolean,
    }
}

export interface IPDataFields {
    /**
     * Continent name
     *
     * Example: North America
     */
    continent?: string;

    /**
     * Two-letter continent code
     *
     * Example: NA
     */
    continentCode?: string;

    /**
     * Country name
     *
     * Example: "United States"
     */
    country?: string;

    /**
     * Two-letter country code ISO 3166-1 alpha-2
     *
     * Example: "US"
     *
     * https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2
     */
    countryCode?: string;

    /**
     * Region/state short code (FIPS or ISO)
     *
     * Examples: "CA", "10"
     */
    region?: string;

    /**
     * Region/State name
     *
     * Example: "California"
     */
    regionName?: string;

    /**
     * City name
     *
     * Example: "Mountain View"
     */
    city?: string;

    /**
     * District (subdivision of city)
     *
     * Example: "Old Farm District"
     */
    district?: string;

    /**
     * Zip code
     *
     * Example: 94043
     */
    zip?: string;

    /**
     * Latitude
     *
     * Example: 37.4192
     */
    lat?: number;

    /**
     * Longitude
     *
     * Example: -122.0574
     */
    lon?: number;

    /**
     * City timezone
     *
     * Example: "America/Los_Angeles"
     */
    timezone?: string;

    /**
     * National currency
     *
     * Example: USD
     */
    currency?: string;

    /**
     * Internet Service Provider Name
     *
     * Example: "Google"
     */
    isp?: string;

    /**
     * Organization name
     *
     * Example: "Google"
     */
    org?: string;

    /**
     * AS number and name, separated by space
     *
     * Example: "AS15169 Google Inc."
     */
    as?: string;

    /**
     * AS name (RIR). Empty for IP blocks not being announced in BGP tables.
     *
     * Example: GOOGLE
     */
    asname?: string;

    /**
     * Reverse DNS of the IP
     *
     * Example: "wi-in-f94.1e100.net"
     */
    reverse?: string;

    /**
     * Mobile (cellular) connection
     */
    mobile?: boolean;

    /**
     * Proxy (anonymous)
     */
    proxy?: boolean;

    /**
     * IPv4 used for the query
     */
    query?: string;

    /** Timezone UTC DST offset in seconds */
    offset?: number;
}

export type EndlessStatLog = EndlessLogLine & {
    stats: EndlessLogStats
}

export type EndlessGeoLog = EndlessLogLine & {
    geo?: IPDataFields
}

export type EndlessLog = EndlessGeoLog & EndlessStatLog;

export interface EndlessLogStats {
    firstSeen: Dayjs
    connections: number
    time: Duration
}


// https://stackoverflow.com/a/70887388/1469797
export type ArbitraryObject = { [key: string]: unknown; };
export function isArbitraryObject(potentialObject: unknown): potentialObject is ArbitraryObject {
    return typeof potentialObject === "object" && potentialObject !== null;
}
