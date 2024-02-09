import {ErrorWithCause} from "pony-cause";

class InvalidRegexError<T = undefined> extends ErrorWithCause<T> {
    constructor(regex: RegExp | RegExp[], val?: string, url?: string, message?: string, options?: { cause?: T} | undefined) {
        const msgParts = [
            message ?? 'Regex(es) did not match the value given.',
        ];
        let regArr = Array.isArray(regex) ? regex : [regex];
        for(const r of regArr) {
            msgParts.push(`Regex: ${r}`)
        }
        if (val !== undefined) {
            msgParts.push(`Value: ${val}`);
        }
        if (url !== undefined) {
            msgParts.push(`Sample regex: ${url}`);
        }
        super(msgParts.join('\r\n'), options);
    }
}

export default InvalidRegexError;
