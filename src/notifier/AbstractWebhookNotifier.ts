import {Logger} from '@foxxmd/winston';
import {mergeArr} from "../utils/index.js";
import {GotifyConfig, NtfyConfig, WebhookConfig, WebhookPayload} from "../common/infrastructure/webhooks.js";

export abstract class AbstractWebhookNotifier {

    config: WebhookConfig
    logger: Logger;

    initialized: boolean = false;
    requiresAuth: boolean = false;
    authed: boolean = false;

    protected constructor(type: string, defaultName: string, config: WebhookConfig, logger: Logger) {
        this.config = config;
        const label = `${type} - ${config.name ?? defaultName}`
        this.logger = logger.child({labels: [label]}, mergeArr);
    }

    initialize = async () => {
        this.initialized = true;
        this.logger.verbose('Initialized');
    }

    testAuth = async () => {
        return;
    }

    notify = async (payload: WebhookPayload) =>  {
        if(!this.initialized) {
            this.logger.debug('Will not use notifier because it is not initialized.');
            return;
        }
        if(this.requiresAuth && !this.authed) {
            this.logger.debug('Will not use notifier because it is not correctly authenticated.');
            return;
        }
        return await this.doNotify(payload);
    }
    abstract doNotify: (payload: WebhookPayload) => Promise<any>;
}
