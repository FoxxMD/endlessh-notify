import winston, {config, format, Logger} from '@foxxmd/winston';
import { AbstractWebhookNotifier } from "./AbstractWebhookNotifier.js";
import { GotifyWebhookNotifier } from "./GotifyWebhookNotifier.js";
import { NtfyWebhookNotifier } from "./NtfyWebhookNotifier.js";
import {EventEmitter} from "events";
import {mergeArr} from "../utils/index.js";
import {
    DiscordConfig,
    GotifyConfig,
    NtfyConfig,
    WebhookConfig,
    WebhookPayload
} from "../common/infrastructure/webhooks.js";
import {DiscordWebhookNotifier} from "./DiscordWebhookNotifier.js";

export class Notifiers {

    logger: Logger;

    webhooks: AbstractWebhookNotifier[] = [];

    emitter: EventEmitter;

    constructor(emitter: EventEmitter = new EventEmitter()) {
        this.emitter = emitter;

        this.logger = winston.loggers.get('app').child({labels: ['Notifiers']}, mergeArr);
    }

    buildWebhooks = async (webhookConfigs: WebhookConfig[]) => {
        for (const [i, config] of Object.entries(webhookConfigs)) {
            let webhook: AbstractWebhookNotifier;
            const defaultName = `Config ${i}`
            switch (config.type) {
                case 'gotify':
                    webhook = new GotifyWebhookNotifier(defaultName, config as GotifyConfig, this.logger);
                    break;
                case 'ntfy':
                    webhook = new NtfyWebhookNotifier(defaultName, config as NtfyConfig, this.logger);
                    break;
                case 'discord':
                    webhook = new DiscordWebhookNotifier(defaultName, config as DiscordConfig, this.logger);
                    break;
                default:
                    // @ts-ignore
                    this.logger.error(`'${config.type}' is not a valid webhook type`);
                    continue;
            }
            await webhook.initialize();
            if(webhook.initialized) {
                await webhook.testAuth();
            }
            this.webhooks.push(webhook);
        }
    }

    notify = async (payload: WebhookPayload) => {
        for (const webhook of this.webhooks) {
            await webhook.notify(payload);
        }
    }
}
