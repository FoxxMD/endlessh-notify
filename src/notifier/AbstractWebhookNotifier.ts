import {Logger} from '@foxxmd/winston';
import {mergeArr, parseDuration} from "../utils/index.js";
import {GotifyConfig, NtfyConfig, WebhookConfig, WebhookPayload} from "../common/infrastructure/webhooks.js";
import {Duration} from "dayjs/plugin/duration.js";
import {ErrorWithCause} from "pony-cause";
import TTLCache from '@isaacs/ttlcache';

export abstract class AbstractWebhookNotifier {

    config: WebhookConfig
    logger: Logger;

    initialized: boolean = false;
    requiresAuth: boolean = false;
    authed: boolean = false;

    ttl: Duration;
    cache: TTLCache<string, boolean>

    protected constructor(type: string, defaultName: string, config: WebhookConfig, logger: Logger) {
        this.config = config;
        const label = `${type} - ${config.name ?? defaultName}`
        this.logger = logger.child({labels: [label]}, mergeArr);
        try {
            this.ttl = parseDuration(config.debounceInterval ?? '1 hour');
        } catch (e) {
            throw new ErrorWithCause(`Unable to parse debounceInterval for ${type} - ${defaultName} => ${config.debounceInterval}`, {cause: e});
        }
        this.cache = new TTLCache<string, boolean>({ max: 500, ttl: this.ttl.asMilliseconds()});
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
        //if(this.cache.has)
        return await this.doNotify(payload);
    }
    abstract doNotify: (payload: WebhookPayload) => Promise<boolean>;
}
