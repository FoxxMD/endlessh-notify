import {AbstractWebhookNotifier} from "./AbstractWebhookNotifier.js";
import {GotifyWebhookNotifier} from "./GotifyWebhookNotifier.js";
import {NtfyWebhookNotifier} from "./NtfyWebhookNotifier.js";
import {EventEmitter} from "events";
import {sleep} from "../utils/index.js";
import {
    DiscordConfig,
    GotifyConfig,
    NtfyConfig,
    WebhookConfig,
    WebhookPayload
} from "../common/infrastructure/webhooks.js";
import {DiscordWebhookNotifier} from "./DiscordWebhookNotifier.js";
import {queue, QueueObject} from 'async';
import {EndlessLog} from "../common/infrastructure/Atomic.js";
import {MapImageService} from "../MapImageService.js";
import {childLogger, Logger} from "@foxxmd/logging";

interface NotifyTask {
    log: EndlessLog
}

export class Notifiers {

    logger: Logger;

    webhooks: AbstractWebhookNotifier[] = [];

    emitter: EventEmitter;

    imageService: MapImageService;

    queue: QueueObject<NotifyTask>;

    constructor(logger: Logger, mapquestKey?: string) {

        this.logger = childLogger(logger, 'Notifiers'); // logger.child({labels: ['Notifiers']}, mergeArr);
        this.queue = this.generateQueue();
        this.queue.error((err, task) => {
           this.logger.warn(err);
        });
        this.imageService = new MapImageService(logger, mapquestKey);
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
                    webhook = new DiscordWebhookNotifier(defaultName, config as DiscordConfig, this.imageService, this.logger);
                    break;
                default:
                    // @ts-ignore
                    this.logger.error(`'${config.type}' is not a valid webhook type`);
                    continue;
            }
            await webhook.initialize();
            if (webhook.initialized) {
                await webhook.testAuth();
            }
            this.webhooks.push(webhook);
        }
    }

    notify = async (payload: WebhookPayload) => {
        let anySent = false;
        for (const webhook of this.webhooks) {
            const res = await webhook.notify(payload);
            if (res !== undefined) {
                anySent = true;
            }
        }
        return anySent;
    }

    protected generateQueue() {
        return queue(async (task: NotifyTask, cb) => {
            const anySent = await this.notify({log: task.log, priority: 'info'});
            if (anySent) {
                await sleep(3000);
            }
        });
    }

    public async push(log: EndlessLog) {
        this.queue.push({log});
    }
}
