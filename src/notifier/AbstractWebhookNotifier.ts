import {Logger} from '@foxxmd/winston';
import {durationToHuman, mergeArr, parseDuration} from "../utils/index.js";
import {
    EventTypeAccept,
    EventTypeClose,
    EventTypeCommon,
    WebhookConfig,
    WebhookPayload
} from "../common/infrastructure/webhooks.js";
import {Duration} from "dayjs/plugin/duration.js";
import {ErrorWithCause} from "pony-cause";
import TTLCache from '@isaacs/ttlcache';
import dayjs, {Dayjs} from "dayjs";
import {EndlessCloseLogLine} from "../common/infrastructure/Atomic.js";

interface HydratedEventTypeCommon extends Omit<EventTypeCommon, 'debounceInterval'> {
    debounceInterval: Duration
    cache: TTLCache<string, Dayjs>
    logger: Logger
}

type HydratedEventTypeAccept = Omit<EventTypeAccept, 'debounceInterval'> & HydratedEventTypeCommon

type HydratedEventTypeClose = HydratedEventTypeCommon & Omit<EventTypeClose, 'debounceInterval' | 'minTrappedTime' | 'maxTrappedTime' | 'minTotalTrappedTime' | 'maxTotalTrappedTime'> & {
    minTrappedTime?: Duration
    minTotalTrappedTime?: Duration
    maxTrappedTime?: Duration
    maxTotalTrappedTime?: Duration
}

export abstract class AbstractWebhookNotifier {

    config: WebhookConfig
    logger: Logger;

    initialized: boolean = false;
    requiresAuth: boolean = false;
    authed: boolean = false;

    ttlStr: string;
    ttl: Duration;
    cache: TTLCache<string, Dayjs>

    acceptEvents: HydratedEventTypeAccept[] = [];
    closeEvents: HydratedEventTypeClose[] = [];

    protected constructor(notifierType: string, defaultName: string, config: WebhookConfig, logger: Logger) {
        this.config = config;
        const label = `${notifierType} - ${config.name ?? defaultName}`
        this.logger = logger.child({labels: [label]}, mergeArr);
        try {
            this.ttlStr = config.debounceInterval ?? '1 day';
            this.ttl = parseDuration(this.ttlStr);
        } catch (e) {
            throw new ErrorWithCause(`Unable to parse debounceInterval for ${notifierType} - ${defaultName} => ${config.debounceInterval}`, {cause: e});
        }

        const {
            events = []
        } = config;
        if(events.length === 0) {
            // First try to get events to use from ENV
            const envStr = process.env.NOTIFY_EVENTS;
            if(envStr !== undefined && envStr.trim() !== '') {
                const envEvents = envStr.split(',').map(x => x.toLocaleLowerCase().trim());
                for(const eType of envEvents) {
                    if(['close', 'accept'].includes(eType)) {
                        throw new ErrorWithCause(`Event type specified in NOTIFY_EVENTS was not valid => ${eType}`);
                    }
                    events.push({type: eType as 'close' | 'accept'});
                }
            }
        }
        if(events.length === 0) {
            // if still no events then only notify on close since it has the most interesting statistics
            events.push({type: 'close'});
        }

        let acceptIndex = 0;
        let closeIndex = 0;
        for(const e of events) {
            const {
                type: eventType,
                debounceInterval,
                name,
                minTotalConnections,
                maxTotalConnections
            } = e;
            let eventName: string | number = name;
            if(eventType === 'accept') {
                eventName = `ACCEPT ${name ?? acceptIndex}`;
            } else {
                eventName = `CLOSE ${name ?? closeIndex}`;
            }
            const durStr = debounceInterval ?? this.ttlStr;
            let dur: Duration;
            try {
                dur = parseDuration(durStr);
            } catch (e) {
                throw new ErrorWithCause(`Unable to parse debounceInterval for ${notifierType} ${eventName} -  => ${debounceInterval}`, {cause: e});
            }
            const eventConfig: HydratedEventTypeCommon  = {
                type: eventType,
                name: eventName,
                debounceInterval: dur,
                minTotalConnections,
                maxTotalConnections,
                cache: new TTLCache<string, Dayjs>({ max: 500, ttl: dur.asMilliseconds()}),
                logger: this.logger.child({labels: [eventName]}, mergeArr)
            }
            if(eventType === 'accept') {
                const hAcceptEvent: HydratedEventTypeAccept = {
                    ...eventConfig,
                    type: 'accept'
                };
                this.acceptEvents.push(hAcceptEvent);
                this.logger.info(eventTypeSummary(hAcceptEvent));
                acceptIndex++;
            } else {
                const {
                    minTrappedTime,
                    minTotalTrappedTime,
                    maxTrappedTime,
                    maxTotalTrappedTime
                } = (e as EventTypeClose);
                const closeEventConfig: HydratedEventTypeClose = {...eventConfig, type: 'close'};
                if(minTrappedTime !== undefined) {
                    try {
                        closeEventConfig.minTrappedTime = parseDuration(minTrappedTime);
                    } catch (err) {
                        throw new ErrorWithCause(`Unable to parse minTrappedTime for ${notifierType} ${eventName} -  => ${minTrappedTime}`, {cause: e});
                    }
                }
                if(minTotalTrappedTime !== undefined) {
                    try {
                        closeEventConfig.minTotalTrappedTime = parseDuration(minTotalTrappedTime);
                    } catch (err) {
                        throw new ErrorWithCause(`Unable to parse minTotalTrappedTime for ${notifierType} ${eventName} -  => ${minTotalTrappedTime}`, {cause: e});
                    }
                }
                if(maxTrappedTime !== undefined) {
                    try {
                        closeEventConfig.maxTrappedTime = parseDuration(maxTrappedTime);
                    } catch (err) {
                        throw new ErrorWithCause(`Unable to parse maxTrappedTime for ${notifierType} ${eventName} -  => ${maxTrappedTime}`, {cause: e});
                    }
                }
                if(maxTotalTrappedTime !== undefined) {
                    try {
                        closeEventConfig.maxTotalTrappedTime = parseDuration(maxTotalTrappedTime);
                    } catch (err) {
                        throw new ErrorWithCause(`Unable to parse maxTotalTrappedTime for ${notifierType} ${eventName} -  => ${maxTotalTrappedTime}`, {cause: e});
                    }
                }
                const hCloseEvent: HydratedEventTypeClose = {
                    ...closeEventConfig,
                    type: 'close'
                };
                this.closeEvents.push(hCloseEvent);
                this.logger.info(eventTypeSummary(hCloseEvent))
                closeIndex++;
            }

        }
    }

    initialize = async () => {
        this.initialized = true;
        this.logger.verbose('Initialized');
    }

    testAuth = async () => {
        return;
    }

    notify = async (payload: WebhookPayload): Promise<boolean | void> =>  {
        if(!this.initialized) {
            this.logger.debug('Will not use notifier because it is not initialized.');
            return;
        }
        if(this.requiresAuth && !this.authed) {
            this.logger.debug('Will not use notifier because it is not correctly authenticated.');
            return;
        }

        if(payload.log.type === 'accept') {
            for(const event of this.acceptEvents) {
                const lastSeen = event.cache.get(payload.log.host.address);
                if(event.maxTotalConnections !== undefined && payload.log.stats.connections > event.maxTotalConnections) {
                    event.logger.debug(`Not sending notification because IP has connected (${payload.log.stats.connections }) more than maxTotalConnections (${event.maxTotalConnections})`);
                    continue;
                }
                if(event.minTotalConnections !== undefined && payload.log.stats.connections < event.minTotalConnections) {
                    event.logger.debug(`Not sending notification because IP has connected (${payload.log.stats.connections }) less than minTotalConnections (${event.minTotalConnections})`);
                    continue;
                }
                if(lastSeen !== undefined) {
                    event.logger.debug(`Not sending notification because IP was seen less than TTL (${durationToHuman(dayjs.duration(dayjs().diff(lastSeen)))} ago)`);
                    continue;
                }
                const res = await this.doNotify(payload);
                if(res) {
                    event.cache.set(payload.log.host.address, dayjs());
                }
                return res;
            }
        } else {
            const log = payload.log as EndlessCloseLogLine;
            for(const event of this.closeEvents) {
                if(event.maxTotalConnections !== undefined && payload.log.stats.connections > event.maxTotalConnections) {
                    event.logger.debug(`Not sending notification because IP has connected (${payload.log.stats.connections }) more than maxTotalConnections (${event.maxTotalConnections})`);
                    continue;
                }
                if(event.minTotalConnections !== undefined && payload.log.stats.connections < event.minTotalConnections) {
                    event.logger.debug(`Not sending notification because IP has connected (${payload.log.stats.connections }) less than minTotalConnections (${event.minTotalConnections})`);
                    continue;
                }
                if(event.minTrappedTime !== undefined && log.duration < event.minTrappedTime) {
                    event.logger.debug(`Not sending notification because trapped time was less than minTrappedTime`);
                    continue;
                }
                if(event.maxTrappedTime !== undefined && log.duration > event.maxTrappedTime) {
                    event.logger.debug(`Not sending notification because trapped time was more than maxTrappedTime`);
                    continue;
                }
                if(event.minTotalTrappedTime !== undefined && payload.log.stats.time < event.minTotalTrappedTime) {
                    event.logger.debug(`Not sending notification because total trapped time was less than minTotalTrappedTime`);
                    continue;
                }
                if(event.maxTotalTrappedTime !== undefined && payload.log.stats.time > event.maxTotalTrappedTime) {
                    event.logger.debug(`Not sending notification because total trapped time was more than maxTotalTrappedTime`);
                    continue;
                }
                const lastSeen = event.cache.get(payload.log.host.address);
                if(lastSeen !== undefined) {
                    event.logger.debug(`Not sending notification because IP was seen less than TTL ago (${durationToHuman(dayjs.duration(dayjs().diff(lastSeen)))} ago)`);
                    continue;
                }
                const res = await this.doNotify(payload);
                if(res) {
                    event.cache.set(payload.log.host.address, dayjs());
                }
                return res;
            }
        }
        return;
    }
    abstract doNotify: (payload: WebhookPayload) => Promise<boolean>;
}

const eventTypeSummary = (et: HydratedEventTypeAccept | HydratedEventTypeClose): string => {
    const parts: string[] = [`Event ${et.name} -- notify if =>`];
    const filters: string[] = [];
    if(isHydratedEventTypeClose(et)) {
        if(et.minTrappedTime !== undefined) {
            filters.push(`Trapped at LEAST ${durationToHuman(et.minTrappedTime)}`);
        }
        if(et.maxTrappedTime !== undefined) {
            filters.push(`Trapped at MOST ${durationToHuman(et.maxTrappedTime)}`);
        }
    }
    filters.push(`New or last seen longer than ${durationToHuman(et.debounceInterval)} ago`);
    parts.push(filters.join(' AND '))
    return `${parts.join(' ')}`
}

const isHydratedEventTypeClose = (et: HydratedEventTypeAccept | HydratedEventTypeClose): et is HydratedEventTypeClose => {
    return et.type === 'close';
}

const isHydratedEventTypeAccept = (et: HydratedEventTypeAccept | HydratedEventTypeClose): et is HydratedEventTypeAccept => {
    return et.type === 'accept';
}
