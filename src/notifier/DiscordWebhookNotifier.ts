import { AbstractWebhookNotifier } from "./AbstractWebhookNotifier.js";
import {Logger} from '@foxxmd/winston';
import {APIEmbed, AttachmentBuilder, BaseMessageOptions, EmbedBuilder, WebhookClient} from "discord.js";
import {DiscordConfig, WebhookPayload} from "../common/infrastructure/webhooks.js";
import {ErrorWithCause} from "pony-cause";
import dayjs from "dayjs";

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
        let flag = '';
        let geoDesc = '';
        let files: AttachmentBuilder[] = [];
        if(payload.log.geo !== undefined) {
            flag = `:flag_${payload.log.geo.countryCode.toLowerCase()}: `;
            geoDesc = ` from ${payload.log.geo?.city}, ${payload.log.geo?.country} (${payload.log.geo?.isp})`
        }
        try {
            const embed: APIEmbed = {
                title: 'New IP Connected',
                url: `https://db-ip.com/${payload.log.host.address}`,
                description: `${flag}${payload.log.host.address}${geoDesc} <https://www.shodan.io/host/${payload.log.host.address}>`
            };
            if(payload.mapImageData !== undefined) {
                const name = `mq-${dayjs().unix()}.jpg`;
                const file = new AttachmentBuilder(payload.mapImageData, {name});
                embed.image = {url: `attachment://${name}`};
                files.push(file);
            }
            await this.client.send({embeds: [embed], files});
            this.logger.debug(`Pushed notification.`);
            return true;
        } catch (e: any) {
            this.logger.error(new ErrorWithCause(`Failed to push notification`, {cause: e}));
            return false;
        }
    }
}
