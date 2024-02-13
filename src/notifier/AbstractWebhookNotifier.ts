import {Logger} from '@foxxmd/winston';
import {durationToHuman, mergeArr, parseDuration} from "../utils/index.js";
import {EventTypeAccept, EventTypeClose, WebhookConfig, WebhookPayload} from "../common/infrastructure/webhooks.js";
import {Duration} from "dayjs/plugin/duration.js";
import {ErrorWithCause} from "pony-cause";
import TTLCache from '@isaacs/ttlcache';
import dayjs, {Dayjs} from "dayjs";
import {EndlessCloseLogLine} from "../common/infrastructure/Atomic.js";

interface HydratedEventTypeAccept extends Omit<EventTypeAccept, 'debounceInterval'> {
    debounceInterval: Duration
    cache: TTLCache<string, Dayjs>
    logger: Logger
}
interface HydratedEventTypeClose extends Omit<EventTypeClose, 'debounceInterval' | 'minTrappedTime' | 'maxTrappedTime'> {
    debounceInterval: Duration
    cache: TTLCache<string, Dayjs>
    logger: Logger
    minTrappedTime?: Duration
    maxTrappedTime?: Duration
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
            events = [{type: 'accept'}]
        } = config;

        let acceptIndex = 0;
        let closeIndex = 0;
        for(const e of events) {
            const {
                type: eventType,
                debounceInterval,
                name,
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
            const eventConfig: any  = {
                type: eventType,
                name: eventName,
                debounceInterval: durStr
            }
            if(eventType === 'accept') {
                const hAcceptEvent: HydratedEventTypeAccept = {
                    ...eventConfig,
                    debounceInterval: dur,
                    cache: new TTLCache<string, Dayjs>({ max: 500, ttl: dur.asMilliseconds()}),
                    logger: this.logger.child({labels: [`Accept ${name ?? acceptIndex}`]}, mergeArr)
                };
                this.acceptEvents.push(hAcceptEvent);
                this.logger.info(eventTypeSummary(hAcceptEvent));
                acceptIndex++;
            } else {
                const {
                    minTrappedTime,
                    maxTrappedTime
                } = (e as EventTypeClose);
                if(minTrappedTime !== undefined) {
                    try {
                        eventConfig.minTrappedTime = parseDuration(minTrappedTime);
                    } catch (err) {
                        throw new ErrorWithCause(`Unable to parse minTrappedTime for ${notifierType} ${eventName} -  => ${minTrappedTime}`, {cause: e});
                    }
                }
                if(maxTrappedTime !== undefined) {
                    try {
                        eventConfig.maxTrappedTime = parseDuration(maxTrappedTime);
                    } catch (err) {
                        throw new ErrorWithCause(`Unable to parse maxTrappedTime for ${notifierType} ${eventName} -  => ${maxTrappedTime}`, {cause: e});
                    }
                }
                const hCloseEvent: HydratedEventTypeClose = {
                    ...eventConfig,
                    debounceInterval: dur,
                    cache: new TTLCache<string, Dayjs>({ max: 500, ttl: dur.asMilliseconds()}),
                    logger: this.logger.child({labels: [`Close ${name ?? acceptIndex}`]}, mergeArr)
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
                if(event.minTrappedTime !== undefined && log.duration < event.minTrappedTime) {
                    event.logger.debug(`Not sending notification because trapped time was less than minTrappedTime`);
                    continue;
                }
                if(event.maxTrappedTime !== undefined && log.duration > event.maxTrappedTime) {
                    event.logger.debug(`Not sending notification because trapped time was more than maxTrappedTime`);
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
