import dayjs, {Dayjs} from "dayjs";
import {AppLogger} from "../common/logging.js";
import {
    replaceResultTransformer,
    stripIndentTransformer,
    TemplateTag,
    TemplateTransformer,
    trimResultTransformer
} from 'common-tags'
import {
    EndlessLogLine,
    isEndlessClose,
    NamedGroup,
    numberFormatOptions,
    RegExResult
} from "../common/infrastructure/Atomic.js";
import {Duration} from "dayjs/plugin/duration.js";
import {ErrorWithCause, getErrorCause} from "pony-cause";
import InvalidRegexError from "../common/errors/InvalidRegexError.js";
import {Address4, Address6} from "ip-address";
import {format} from "logform";

export const overwriteMerge = (destinationArray: any[], sourceArray: any[], options: any): any[] => sourceArray;

export const capitalize = (str: string): string => {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

export const mergeArr = (objValue: [], srcValue: []): (any[] | undefined) => {
    if (Array.isArray(objValue)) {
        return objValue.concat(srcValue);
    }
}

export const valToString = (val: any): string => {
    const t = typeof val;
    if (t === 'boolean') {
        return val === true ? '1' : '0';
    }
    return val.toString();
}

export const intersect = (a: Array<any>, b: Array<any>) => {
    const setA = new Set(a);
    const setB = new Set(b);
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    return Array.from(intersection);
}

/**
 * @see https://stackoverflow.com/a/64245521/1469797
 * */
function* setMinus(A: Array<any>, B: Array<any>) {
    const setA = new Set(A);
    const setB = new Set(B);

    for (const v of setB.values()) {
        if (!setA.delete(v)) {
            yield v;
        }
    }

    for (const v of setA.values()) {
        yield v;
    }
}

/**
 * Returns elements that both arrays do not have in common
 */
export const symmetricalDifference = (a: Array<any>, b: Array<any>) => {
    return Array.from(setMinus(a, b));
}

/**
 * Returns a Set of elements from valA not in valB
 * */
export function difference<T = any>(valA: Set<T> | Array<T>, valB: Set<T> | Array<T>) {
    const setA = valA instanceof Set ? valA : new Set(valA);
    const setB = valB instanceof Set ? valB : new Set(valB);
    const _difference = new Set(setA);
    for (const elem of setB) {
        _difference.delete(elem);
    }
    return _difference;
}

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export interface ReplyOptions {
    defer?: boolean,
    edit?: boolean
}

export class RateLimitFunc {
    public lastExecute?: Dayjs;
    public msBetween: number;
    protected shouldWait: boolean;
    protected logger?: AppLogger;

    constructor(msBetween: number, shouldWait: boolean, logger?: AppLogger) {
        this.msBetween = msBetween;
        this.lastExecute = dayjs().subtract(msBetween + 1, 'ms');
        this.logger = logger;
        this.shouldWait = shouldWait;
    }

    async exec(func: Function, shouldCheck?: boolean) {
        if (shouldCheck ?? true) {
            const since = dayjs().diff(this.lastExecute, 'milliseconds');
            const shouldExec = since > this.msBetween;
            if (!shouldExec && this.shouldWait) {
                const willWait = this.msBetween - since;
                if (this.logger !== undefined) {
                    this.logger.debug(`Will wait ${willWait}ms`);
                }
                await sleep(willWait);
            }
            if (shouldExec || (!shouldExec && this.shouldWait)) {
                // its past time OR we waited
                await func();
                this.lastExecute = dayjs();
            }
        }
    }
}

export const chunk = <T>(arr: T[], size: number): T[][] =>
    Array.from({length: Math.ceil(arr.length / size)}, (v, i) =>
        arr.slice(i * size, i * size + size)
    );

export const randomNumber = (max: number = 100) => {
    return Math.floor(Math.random() * max);
}

export const uniqueRandomNumber = (max: number = 100) => {
    const existing: number[] = [];
    return () => {
        const num = randomNumber(max);
        if (!existing.includes(num)) {
            existing.push(num);
            return num;
        }
    }
}

export function parseBool(value: any, prev: any = false): boolean {
    let usedVal = value;
    if (value === undefined || value === '') {
        usedVal = prev;
    }
    if(usedVal === undefined || usedVal === '') {
        return false;
    }
    if (typeof usedVal === 'string') {
        return ['1','true','yes'].includes(usedVal.toLocaleLowerCase().trim());
    } else if (typeof usedVal === 'boolean') {
        return usedVal;
    }
    throw new Error(`'${value.toString()}' is not a boolean value.`);
}

export const plainTag = new TemplateTag(
    stripIndentTransformer('all'),
    trimResultTransformer()
);

// https://github.com/zspecza/common-tags/issues/176#issuecomment-1650242734
export const doubleReturnNewline = new TemplateTag(
    stripIndentTransformer('all'),
    // remove instances of single line breaks
    replaceResultTransformer(/(?<=.)\n(?!\n+)/g, ''),
    // replace instances of two or more line breaks with one line break
    replaceResultTransformer(/(?<=.)\n{2,}/g, '\n'),
    trimResultTransformer(),
);

export const truncateStringToLength = (length: any, truncStr = '...') => (val: any = '') =>  {
    if(val === null) {
        return '';
    }
    const str = typeof val !== 'string' ? val.toString() : val;
    return str.length > length ? `${str.slice(0, length)}${truncStr}` : str;
}

export const parseRegex = (reg: RegExp, val: string): RegExResult[] | undefined => {

    if (reg.global) {
        const g = Array.from(val.matchAll(reg));
        if (g.length === 0) {
            return undefined;
        }
        return g.map(x => {
            return {
                match: x[0],
                index: x.index,
                groups: x.slice(1),
                named: x.groups || {},
            } as RegExResult;
        });
    }

    const m = val.match(reg)
    if (m === null) {
        return undefined;
    }
    return [{
        match: m[0],
        index: m.index as number,
        groups: m.slice(1),
        named: m.groups || {}
    }];
}

export const parseRegexSingleOrFail = (reg: RegExp, val: string): RegExResult | undefined => {
    const results = parseRegex(reg, val);
    if (results !== undefined) {
        if (results.length > 1) {
            throw new ErrorWithCause(`Expected Regex to match once but got ${results.length} results. Either Regex must NOT be global (using 'g' flag) or parsed value must only match regex once. Given: ${val} || Regex: ${reg.toString()}`);
        }
        return results[0];
    }
    return undefined;
}

// string must only contain ISO8601 optionally wrapped by whitespace
const ISO8601_REGEX: RegExp = /^\s*((-?)P(?=\d|T\d)(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)([DW]))?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?)\s*$/;
// finds ISO8601 in any part of a string
const ISO8601_SUBSTRING_REGEX: RegExp = /((-?)P(?=\d|T\d)(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)([DW]))?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?)/g;
// string must only duration optionally wrapped by whitespace
const DURATION_REGEX: RegExp = /^\s*(?<time>\d+)\s*(?<unit>days?|weeks?|months?|years?|hours?|minutes?|seconds?|milliseconds?)\s*$/;
// finds duration in any part of the string
const DURATION_SUBSTRING_REGEX: RegExp = /(?<time>\d+)\s*(?<unit>days?|weeks?|months?|years?|hours?|minutes?|seconds?|milliseconds?)/g;

export const parseDurationFromString = (val: string, strict = true): {duration: Duration, original: string}[] => {
    let matches = parseRegex(strict ? DURATION_REGEX : DURATION_SUBSTRING_REGEX, val);
    if (matches !== undefined) {
        return matches.map(x => {
            const groups = x.named as NamedGroup;
            const dur: Duration = dayjs.duration(groups.time, groups.unit);
            if (!dayjs.isDuration(dur)) {
                throw new ErrorWithCause(`Parsed value '${x.match}' did not result in a valid Dayjs Duration`);
            }
            return {duration: dur, original: `${groups.time} ${groups.unit}`};
        });
    }

    matches = parseRegex(strict ? ISO8601_REGEX : ISO8601_SUBSTRING_REGEX, val);
    if (matches !== undefined) {
        return matches.map(x => {
            const dur: Duration = dayjs.duration(x.groups[0]);
            if (!dayjs.isDuration(dur)) {
                throw new ErrorWithCause(`Parsed value '${x.groups[0]}' did not result in a valid Dayjs Duration`);
            }
            return {duration: dur, original: x.groups[0]};
        });
    }

    throw new InvalidRegexError([(strict ? DURATION_REGEX : DURATION_SUBSTRING_REGEX), (strict ? ISO8601_REGEX : ISO8601_SUBSTRING_REGEX)], val)
}

export const parseDuration = (val: string, strict = true): Duration => {
    const res = parseDurationFromString(val, strict);
    if(res.length > 1) {
        throw new ErrorWithCause(`Must only have one Duration value, found ${res.length} in: ${val}`);
    }
    return res[0].duration;
}

const ENDLESS_GO_ACCEPT_REGEX: RegExp = new RegExp(/^I(?<month>\d{2})(?<day>\d{2}) (?<time>\d{2}:\d{2}:\d{2}.\d{3})\d{3}.+ACCEPT host=(?<host>\S+)/i);
const ENDLESS_GO_CLOSE_REGEX: RegExp = new RegExp(/^I(?<month>\d{2})(?<day>\d{2}) (?<time>\d{2}:\d{2}:\d{2}.\d{3})\d{3}.+CLOSE host=(?<host>\S+).+time=(?<duration>\S+)/i);

const ENDLESS_ACCEPT_REGEX: RegExp = new RegExp(/^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2}) (?<time>\d{2}:\d{2}:\d{2}.\d{3})\d{3}.+ACCEPT host=(?<host>\S+)/i);
const ENDLESS_CLOSE_REGEX: RegExp = new RegExp(/^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2}) (?<time>\d{2}:\d{2}:\d{2}.\d{3})\d{3}.+CLOSE host=(?<host>\S+).+time=(?<duration>\S+)/i);

const ENDLESS_ACCEPTS: RegExp[] = [ENDLESS_GO_ACCEPT_REGEX, ENDLESS_ACCEPT_REGEX];
const ENDLESS_CLOSES: RegExp[] = [ENDLESS_GO_CLOSE_REGEX, ENDLESS_CLOSE_REGEX];

export const parseEndlessLogLine = (line: string): EndlessLogLine | undefined => {
    for(const reg of ENDLESS_ACCEPTS) {
        let res = parseRegexSingleOrFail(reg, line);
        if (res !== undefined) {
            let address: Address6 | Address4;
            try {
                address = parseToAddress(res.named.host);
            } catch (e) {
                throw new ErrorWithCause('Could not parse log line', {cause: e});
            }
            return {
                type: 'accept',
                time: dayjs(`${res.named.year ?? dayjs().year()}-${res.named.month}-${res.named.day}T${res.named.time}`, {utc: false}),
                host: address
            }
        }
    }

    for(const reg of ENDLESS_CLOSES) {
        const res = parseRegexSingleOrFail(reg, line);
        if (res !== undefined) {
            let address: Address6 | Address4;
            try {
                address = parseToAddress(res.named.host);
            } catch (e) {
                throw new ErrorWithCause('Could not parse log line', {cause: e});
            }
            return {
                type: 'close',
                time: dayjs(`${res.named.year ?? dayjs().year()}-${res.named.month}-${res.named.day}T${res.named.time}`, {utc: false}),
                host: address,
                duration: dayjs.duration(Number.parseFloat(res.named.duration), 's')
            }
        }
    }

    return undefined;
}

export const parseToAddress = (val: string): Address4 | Address6 => {
    let address: Address6 | Address4;
    if (Address4.isValid(val)) {
        address = new Address4(val);
    } else if (Address6.isValid(val)) {
        address = new Address6(val)
    } else {
        throw new ErrorWithCause(`Could not parse host '${val}' as a valid ipv4 or ipv6 address!`);
    }
    return address;
}

export const endlessLogLineToFriendly = (line: EndlessLogLine): string => {
    const parts = [
        line.time.format(),
        line.type === 'accept' ? 'ACCEPT' : 'CLOSE',
        `${(line.host instanceof Address4) ? 'IPV4' : 'IPv6'} ${line.host.address}`
    ];
    if(isEndlessClose(line)) {
        parts.push(`Trapped ${durationToHuman(line.duration)}`)
    }
    return parts.join(' | ');
}

export const durationToNormalizedTime = (dur: Duration): { hours: number, minutes: number, seconds: number } => {
    const totalSeconds = dur.asSeconds();

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds - (hours * 3600)) / 60);
    const seconds = totalSeconds - (hours * 3600) - (minutes * 60);

    return {
        hours,
        minutes,
        seconds
    };
}

export const durationToTimestamp = (dur: Duration): string => {
    const nTime = durationToNormalizedTime(dur);

    const parts: string[] = [];
    if (nTime.hours !== 0) {
        parts.push(nTime.hours.toString().padStart(2, "0"));
    }
    parts.push(nTime.minutes.toString().padStart(2, "0"));
    parts.push(nTime.seconds.toString().padStart(2, "0"));
    return parts.join(':');
}

export const durationToHuman = (dur: Duration): string => {
    const nTime = durationToNormalizedTime(dur);

    const parts: string[] = [];
    if (nTime.hours !== 0) {
        parts.push(`${nTime.hours} hr`);
    }
    parts.push(`${nTime.minutes} min`);
    parts.push(`${formatNumber(nTime.seconds, {toFixed: 0})} sec`);
    return parts.join(' ');
}

export const formatNumber = (val: number | string, options?: numberFormatOptions) => {
    const {
        toFixed = 2,
        defaultVal = null,
        prefix = '',
        suffix = '',
        round,
    } = options || {};
    let parsedVal = typeof val === 'number' ? val : Number.parseFloat(val);
    if (Number.isNaN(parsedVal)) {
        return defaultVal;
    }
    if(!Number.isFinite(val)) {
        return 'Infinite';
    }
    let prefixStr = prefix;
    const {enable = false, indicate = true, type = 'round'} = round || {};
    if (enable && !Number.isInteger(parsedVal)) {
        switch (type) {
            case 'round':
                parsedVal = Math.round(parsedVal);
                break;
            case 'ceil':
                parsedVal = Math.ceil(parsedVal);
                break;
            case 'floor':
                parsedVal = Math.floor(parsedVal);
        }
        if (indicate) {
            prefixStr = `~${prefix}`;
        }
    }
    const localeString = parsedVal.toLocaleString(undefined, {
        minimumFractionDigits: toFixed,
        maximumFractionDigits: toFixed,
    });
    return `${prefixStr}${localeString}${suffix}`;
};

/**
 * Adapted from https://github.com/voxpelli/pony-cause/blob/main/lib/helpers.js to find cause by truthy function
 * */
export const findCauseByFunc = (err: any, func: (e: Error) => boolean) => {
    if (!err || !func) return;
    if (!(err instanceof Error)) return;
    if (typeof func !== 'function') {
        return;
    }

    /**
     * Ensures we don't go circular
     */
    const seen = new Set<Error>();

    let currentErr: Error | undefined = err;

    while (currentErr && !seen.has(currentErr)) {
        seen.add(currentErr);

        if (func(currentErr)) {
            return currentErr;
        }

        currentErr = getErrorCause(currentErr);
    }
};
