import { AbstractWebhookNotifier } from "./AbstractWebhookNotifier.js";
import {Logger} from '@foxxmd/winston';
import {BaseMessageOptions, WebhookClient} from "discord.js";
import {DiscordConfig, WebhookPayload} from "../common/infrastructure/webhooks.js";
import {ErrorWithCause} from "pony-cause";

export class DiscordWebhookNotifier extends AbstractWebhookNotifier {

    declare config: DiscordConfig;
    client: WebhookClient;

    constructor(defaultName: string, config: DiscordConfig, logger: Logger) {
        super('Discord', defaultName, config, logger);
        this.requiresAuth = false;
        this.client = new WebhookClient({url: config.webhook})
    }

    initialize = async () => {
        // check url is correct
        try {
            this.logger.verbose(`Initialized.`);
            this.initialized = true;
        } catch (e) {
            this.logger.error(`Failed to contact server | Error: ${e.message}`);
        }
    }

    testAuth = async () => {
        this.authed = true;
    }

    doNotify = async (payload: WebhookPayload) => {
        try {
            await this.client.send({} as unknown as BaseMessageOptions);
            this.logger.debug(`Pushed notification.`);
        } catch (e: any) {
            this.logger.error(new ErrorWithCause(`Failed to push notification`, {cause: e}));
        }
    }
}
