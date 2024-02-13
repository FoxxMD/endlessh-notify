import {Logger} from '@foxxmd/winston';
import {durationToHuman, mergeArr, parseDuration} from "../utils/index.js";
import {EventTypeAccept, EventTypeClose, WebhookConfig, WebhookPayload} from "../common/infrastructure/webhooks.js";
import {Duration} from "dayjs/plugin/duration.js";
import {ErrorWithCause} from "pony-cause";
import TTLCache from '@isaacs/ttlcache';
import dayjs, {Dayjs} from "dayjs";
import {EndlessCloseLogLine} from "../common/infrastructure/Atomic.js";

interface HashedEventTypeAccept extends Omit<EventTypeAccept, 'debounceInterval'> {
    hash: string
    debounceInterval: Duration
    cache: TTLCache<string, Dayjs>
    logger: Logger
}
interface HashedEventTypeClose extends Omit<EventTypeClose, 'debounceInterval' | 'minTrappedTime' | 'maxTrappedTime'> {
    hash: string
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

    acceptEvents: HashedEventTypeAccept[] = [];
    closeEvents: HashedEventTypeClose[] = [];

    protected constructor(type: string, defaultName: string, config: WebhookConfig, logger: Logger) {
        this.config = config;
        const label = `${type} - ${config.name ?? defaultName}`
        this.logger = logger.child({labels: [label]}, mergeArr);
        try {
            this.ttlStr = config.debounceInterval ?? '1 day';
            this.ttl = parseDuration(this.ttlStr);
        } catch (e) {
            throw new ErrorWithCause(`Unable to parse debounceInterval for ${type} - ${defaultName} => ${config.debounceInterval}`, {cause: e});
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
            if(eventName === undefined) {
                if(type === 'accept') {
                    eventName = acceptIndex;
                } else {
                    eventName = closeIndex;
                }
            }
            const durStr = debounceInterval ?? this.ttlStr;
            let dur: Duration;
            try {
                dur = parseDuration(durStr);
            } catch (e) {
                throw new ErrorWithCause(`Unable to parse debounceInterval for ${type} ${eventType} ${eventName} -  => ${debounceInterval}`, {cause: e});
            }
            const eventConfig: any  = {
                type,
                debounceInterval: durStr
            }
            if(type === 'accept') {
                this.acceptEvents.push({
                    ...eventConfig,
                    debounceInterval: dur,
                    cache: new TTLCache<string, Dayjs>({ max: 500, ttl: dur.asMilliseconds()}),
                    logger: this.logger.child({labels: [`Accept ${name ?? acceptIndex}`]}, mergeArr)
                });
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
                        throw new ErrorWithCause(`Unable to parse minTrappedTime for ${type} ${eventType} ${eventName} -  => ${minTrappedTime}`, {cause: e});
                    }
                }
                if(maxTrappedTime !== undefined) {
                    try {
                        eventConfig.maxTrappedTime = parseDuration(maxTrappedTime);
                    } catch (err) {
                        throw new ErrorWithCause(`Unable to parse maxTrappedTime for ${type} ${eventType} ${eventName} -  => ${maxTrappedTime}`, {cause: e});
                    }
                }
                this.closeEvents.push({
                    ...eventConfig,
                    debounceInterval: dur,
                    cache: new TTLCache<string, Dayjs>({ max: 500, ttl: dur.asMilliseconds()}),
                    logger: this.logger.child({labels: [`Close ${name ?? acceptIndex}`]}, mergeArr)
                });
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
                    return;
                }
                const res = await this.doNotify(payload);
                if(res) {
                    event.cache.set(payload.log.host.address, dayjs());
                }
            }
        } else {
            const log = payload.log as EndlessCloseLogLine;
            for(const event of this.closeEvents) {
                if(event.minTrappedTime !== undefined && log.duration < event.minTrappedTime) {
                    event.logger.debug(`Not sending notification because trapped time was less than minTrappedTime`);
                    return;
                }
                if(event.maxTrappedTime !== undefined && log.duration > event.maxTrappedTime) {
                    event.logger.debug(`Not sending notification because trapped time was more than maxTrappedTime`);
                    return;
                }
                const lastSeen = event.cache.get(payload.log.host.address);
                if(lastSeen !== undefined) {
                    event.logger.debug(`Not sending notification because IP was seen less than TTL ago (${durationToHuman(dayjs.duration(dayjs().diff(lastSeen)))} ago)`);
                    return;
                }
                const res = await this.doNotify(payload);
                if(res) {
                    event.cache.set(payload.log.host.address, dayjs());
                }
            }
        }
    }
    abstract doNotify: (payload: WebhookPayload) => Promise<boolean>;
}
