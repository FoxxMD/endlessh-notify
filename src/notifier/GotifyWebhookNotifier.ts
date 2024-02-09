import { AbstractWebhookNotifier } from "./AbstractWebhookNotifier.js";
import {gotify} from 'gotify';
import got, {HTTPError} from "got";
import {Logger} from '@foxxmd/winston';
import {GotifyConfig, PrioritiesConfig, WebhookPayload} from "../common/infrastructure/webhooks.js";

export class GotifyWebhookNotifier extends AbstractWebhookNotifier {

    declare config: GotifyConfig;

    priorities: PrioritiesConfig;

    constructor(defaultName: string, config: GotifyConfig, logger: Logger) {
        super('Gotify', defaultName, config, logger);
        this.requiresAuth = true;
        const {
            info = 5,
            warn = 7,
            error = 10
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
            const resp = await got.get(`${url}/version`).json<{version: string}>();
            this.logger.verbose(`Initialized. Found Server version ${resp.version}`);
            this.initialized = true;
        } catch (e) {
            this.logger.error(`Failed to contact server | Error: ${e.message}`);
        }
    }

    testAuth = async () => {
        this.authed = true;
        // TODO no easy way to test token is working without also pushing a message -- instead will de-auth if we get the right error message when trying to push for the first time
    }

    doNotify = async (payload: WebhookPayload) => {
        try {
            await gotify({
                server: this.config.url,
                app: this.config.token,
                message: `New IP ${payload.log.host.address} connected`,
                title: 'New IP Connected',
                priority: this.priorities[payload.priority]
            });
            this.logger.debug(`Pushed notification.`);
            return true;
        } catch (e: any) {
            if(e instanceof HTTPError && e.response.statusCode === 401) {
                this.logger.error(`Unable to push notification. Error returned with 401 which means the TOKEN provided is probably incorrect. Disabling Notifier | Error => ${e.response.body}`);
                this.authed = false;
            } else {
                this.logger.error(`Failed to push notification | Error => ${e.message}`);
            }
            return false;
        }
    }
}
