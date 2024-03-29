import {AbstractWebhookNotifier} from "./AbstractWebhookNotifier.js";
import {Config, publish} from 'ntfy';
import got from 'got';
import {NtfyConfig, PrioritiesConfig, WebhookPayload} from "../common/infrastructure/webhooks.js";
import {durationToHuman} from "../utils/index.js";
import {Logger} from "@foxxmd/logging";

export class NtfyWebhookNotifier extends AbstractWebhookNotifier {

    declare config: NtfyConfig;

    priorities: PrioritiesConfig;

    constructor(defaultName: string, config: NtfyConfig, logger: Logger) {
        super('Ntfy', defaultName, config, logger);
        const {
            info = 3,
            warn = 4,
            error = 5
        } = this.config.priorities || {};

        this.priorities = {
            info,
            warn,
            error
        }

    }

    initialize = async () => {
        // check url is correct
        try {
            const url = this.config.url;
            const resp = await got.get(`${url}/v1/health`).json<{health: boolean}>();
            if(resp !== undefined && typeof resp === 'object') {
                const {health} = resp;
                if(health === false) {
                    this.logger.error('Found Ntfy server but it responded that it was not ready.')
                    return;
                }
            } else {
                this.logger.error(`Found Ntfy server but expected a response with 'health' in payload. Found => ${resp}`);
                return;
            }
            this.logger.info('Initialized. Found Ntfy server');
            this.initialized = true;
        } catch (e) {
            this.logger.error(`Failed to contact Ntfy server | Error: ${e.message}`);
        }
    }

    doNotify = async (payload: WebhookPayload) => {
        try {
            const req: Config = {
                message: payload.log.type === 'accept' ? `${payload.log.host.address} Trapped` : `${payload.log.host.address} Disconnected after ${durationToHuman(payload.log.duration)}`,
                topic: this.config.topic,
                title: payload.log.type === 'accept' ? 'New IP Trapped' : 'New IP Disconnected',
                server: this.config.url,
                priority: this.priorities[payload.priority],
            };
            if (this.config.username !== undefined) {
                req.authorization = {
                    username: this.config.username,
                    password: this.config.password,
                }
            }
            await publish(req);
            return true;
        } catch (e: any) {
            this.logger.error(`Failed to push notification: ${e.message}`)
            return false;
        }
    }

}
