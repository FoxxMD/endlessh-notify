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
import {LRUCache} from "lru-cache";

export class Notifiers {

    logger: Logger;

    webhooks: AbstractWebhookNotifier[] = [];

    emitter: EventEmitter;

    mapquestKey?: string;
    imageCache: LRUCache<string,string> = new LRUCache({max: 100});

    constructor(logger: Logger, mapquestKey?: string, emitter: EventEmitter = new EventEmitter()) {
        this.emitter = emitter;
        this.mapquestKey = mapquestKey;

        this.logger = logger.child({labels: ['Notifiers']}, mergeArr);

        if(this.mapquestKey !== undefined) {
            this.logger.info('Mapquest Key found. Will generate map images for Discord notifiers.');
        } else {
            this.logger.info('No Mapquest Key found. Will NOT generate map images for Discord notifiers.');
        }
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
        let anySent = false;
        for (const webhook of this.webhooks) {
            const res = await webhook.notify(payload);
            if(res !== undefined) {
                anySent = true;
            }
        }
        return anySent;
    }
}
