import dayjs, {Dayjs} from "dayjs";
import {faker} from '@faker-js/faker';
import {
    EndlesshAcceptLineStr,
    EndlesshCloseLineStr,
    EndlesshGoAcceptLineStr, EndlesshGoCloseLineStr,
    IPAddress
} from "../../src/common/infrastructure/Atomic.js";
import {Address4} from "ip-address";
import {plainTag} from "../../src/utils/index.js";

export const fakePort = (min: number = 30000, max: number = 60000) => {
    return faker.number.int({min, max})
}

export interface EndlessAcceptOptions {
    timestamp?: Dayjs
    host?: IPAddress
    port?: number
    slot?: number
}

export interface EndlessCloseOptions extends EndlessAcceptOptions {
    duration?: number
    bytes?: number
}

export interface EndlessPairOptions extends EndlessCloseOptions {
    /** number of seconds between accept/close */
    gap?: number
}

const endlesshAccept = (options?: EndlessAcceptOptions): [EndlesshAcceptLineStr, Required<EndlessAcceptOptions>] => {
    const {
        host = new Address4(faker.internet.ipv4()),
        timestamp = dayjs(),
        port = fakePort(),
        slot = 1
    } = options || {};
    const realOpts: Required<EndlessAcceptOptions> = {
        host,
        timestamp,
        port,
        slot
    }
    return [`${timestamp.format('YYYY-MM-DD HH:mm:ss.SSS000000')} ${timestamp.toISOString()} ACCEPT host=${host.address} port=${port} fd=4 n=${slot}/50`, realOpts];
}

const endlesshClose = (options?: EndlessCloseOptions): [EndlesshCloseLineStr, Required<EndlessCloseOptions>] => {
    const {
        host = new Address4(faker.internet.ipv4()),
        timestamp = dayjs(),
        port = fakePort(),
        duration = faker.number.int({min: 1, max: 1200}),
        bytes = faker.number.int({min: 1, max: 1000}),
        slot = 1,
    } = options || {};
    const realOpts: Required<EndlessCloseOptions> = {
        host,
        timestamp,
        port,
        duration,
        bytes,
        slot
    }
    return [`${timestamp.format('YYYY-MM-DD HH:mm:ss.SSS000000')} ${timestamp.toISOString()} CLOSE host=${host.address} port=${port} fd=4 time=${duration}.000 bytes=${bytes}`, realOpts]
}

const endlesshGoAccept = (options?: EndlessAcceptOptions): [EndlesshGoAcceptLineStr, Required<EndlessAcceptOptions>] => {
    const {
        host = new Address4(faker.internet.ipv4()),
        timestamp = dayjs(),
        port = fakePort(),
        slot = 1
    } = options || {};

    const realOpts: Required<EndlessAcceptOptions> = {
        host,
        timestamp,
        port,
        slot
    }
    return [`I${timestamp.format('MMDD HH:mm:ss.SSS000')}       1 client.go:58] ACCEPT host=${host.address} port=${port} n=${slot}/50`, realOpts]
}

const endlesshGoClose = (options?: EndlessCloseOptions): [EndlesshGoCloseLineStr, Required<EndlessCloseOptions>] => {
    const {
        host = new Address4(faker.internet.ipv4()),
        timestamp = dayjs(),
        port = fakePort(),
        duration = faker.number.int({min: 1, max: 1200}),
        bytes = faker.number.int({min: 1, max: 1000}),
        slot = 1,
    } = options || {};
    const realOpts: Required<EndlessCloseOptions> = {
        host,
        timestamp,
        port,
        duration,
        bytes,
        slot
    }
    return [`I${timestamp.format('MMDD HH:mm:ss.SSS000')}       1 client.go:99] CLOSE host=${host.address} port=${port} time=${duration}.000000000 bytes=${bytes}`, realOpts]
}

const endlesshLinePair = (options?: EndlessPairOptions): {
    start: Dayjs,
    end: Dayjs,
    accept: EndlesshAcceptLineStr,
    acceptOpts: Required<EndlessAcceptOptions>,
    close: EndlesshCloseLineStr
    closeOpts: Required<EndlessCloseOptions>
} => {
    const {
        host = new Address4(faker.internet.ipv4()),
        timestamp = dayjs(),
        port = fakePort(),
        gap = faker.number.int({min: 1, max: 10}),
        duration = faker.number.int({min: 1, max: 1200}),
        bytes = faker.number.int({min: 1, max: 1000})
    } = options || {};

    const persistentOptions = {
        ...options,
        host,
        timestamp,
        port,
        duration: duration,
        bytes
    }

    const [acceptStr, acceptOpts] = endlesshAccept(persistentOptions);
    const end = timestamp.add(gap, 'seconds');
    const [closeStr, closeOpts] = endlesshClose({...persistentOptions, timestamp: end});

    return {start: timestamp, end, accept: acceptStr, acceptOpts, close: closeStr, closeOpts};
}

const endlesshGoLinePair = (options?: EndlessPairOptions): {
    start: Dayjs,
    end: Dayjs,
    accept: EndlesshGoAcceptLineStr,
    acceptOpts: Required<EndlessAcceptOptions>,
    close: EndlesshGoCloseLineStr
    closeOpts: Required<EndlessCloseOptions>
} => {
    const {
        host = new Address4(faker.internet.ipv4()),
        timestamp = dayjs(),
        port = fakePort(),
        duration = faker.number.int({min: 1, max: 1200}),
        bytes = faker.number.int({min: 1, max: 1000})
    } = options || {};

    const persistentOptions = {
        ...options,
        host,
        timestamp,
        port,
        duration: duration,
        bytes
    }

    const [acceptStr, acceptOpts] = endlesshGoAccept(persistentOptions);
    const end = timestamp.add(10, 'seconds');
    const [closeStr, closeOpts] = endlesshGoClose({...persistentOptions, timestamp: end});

    return {start: timestamp, end, accept: acceptStr, acceptOpts, close: closeStr, closeOpts};
}

const endlesshLogTemplate = (timestamp: Dayjs = dayjs()) => {
    const formatted = `${timestamp.format('YYYY-MM-DD HH:mm:ss.SSS000000')} ${timestamp.toISOString()}`;
    return plainTag`
${formatted} Port 2222
${formatted} Delay 10000
${formatted} MaxLineLength 10
${formatted} MaxClients 50
${formatted} BindFamily IPv4 Mapped IPv6`
}

const endlesshGoLogTemplate = (timestamp: Dayjs = dayjs()) => {
    const formatted = `I${timestamp.format('MM-DD HH:mm:ss.SSS000')}`;
    return plainTag`
Log file created at: 2024/02/01 18:17:06
Running on machine: 0b167d585529
Binary: Built with gc go1.21.6 for linux/amd64
Previous log: <none>
Log line format: [IWEF]mmdd hh:mm:ss.uuuuuu threadid file:line] msg
${formatted}       1 metrics.go:90] Starting Prometheus on 0.0.0.0:2112, entry point is /metrics
${formatted}       1 main.go:78] Listening on 0.0.0.0:2222`
}

const endlesshLog = (generatedPairs = faker.number.int({min: 1, max: 10}), timestamp: Dayjs = dayjs()) => {
    const parts = [endlesshLogTemplate(timestamp)];
    let currTime = timestamp.add(1, 'second');
    for (let i = 0; i < generatedPairs; i++) {
        const pairRes = endlesshLinePair({timestamp: currTime});
        parts.push(pairRes.accept);
        parts.push(pairRes.close);
        currTime = pairRes.end.add(2, 'seconds');
    }
    return `${parts.join('\n')}\n`;
}

const endlesshGoLog = (generatedPairs = faker.number.int({min: 1, max: 10}), timestamp: Dayjs = dayjs()) => {
    const parts = [endlesshGoLogTemplate(timestamp)];
    let currTime = timestamp.add(1, 'second');
    for (let i = 0; i < generatedPairs; i++) {
        const pairRes = endlesshGoLinePair({timestamp: currTime});
        parts.push(pairRes.accept);
        parts.push(pairRes.close);
        currTime = pairRes.end.add(2, 'seconds');
    }
    return `${parts.join('\n')}\n`;
}

/*export interface EndlessFlavorUtilities {
    accept:
}*/

export const endlessh = {
    fileName: 'current',
    accept: endlesshAccept,
    close: endlesshClose,
    linePair: endlesshLinePair,
    logTemplate: endlesshLogTemplate,
    log: endlesshLog,
};

export const endlesshGo = {
    fileName: 'endlessh.INFO',
    accept: endlesshGoAccept,
    close: endlesshGoClose,
    linePair: endlesshGoLinePair,
    logTemplate: endlesshGoLogTemplate,
    log: endlesshGoLog
}
