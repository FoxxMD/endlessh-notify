import {AbstractWebhookNotifier} from "./AbstractWebhookNotifier.js";
import {Logger} from '@foxxmd/winston';
import {APIEmbed, AttachmentBuilder, BaseMessageOptions, EmbedBuilder, WebhookClient, time} from "discord.js";
import {DiscordConfig, WebhookPayload} from "../common/infrastructure/webhooks.js";
import {ErrorWithCause} from "pony-cause";
import dayjs from "dayjs";
import {doubleReturnNewline, durationToHuman, plainTag} from "../utils/index.js";

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

        let files: AttachmentBuilder[] = [];
        try {

            const embed = DiscordWebhookNotifier.generateEmbed(payload);

            if (payload.mapImageData !== undefined) {
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


    public static generateEmbed(payload: WebhookPayload): APIEmbed {
        let flag = '';
        let geoDesc = '';

        if (payload.log.geo !== undefined) {
            flag = `:flag_${payload.log.geo.countryCode.toLowerCase()}: `;
            geoDesc = ` from ${payload.log.geo?.city}, ${payload.log.geo?.country} (${payload.log.geo?.isp})`
        }

        try {
            const trapped = payload.log.type === 'accept' ? '' : `\nTrapped for **${durationToHuman(payload.log.duration)}**`;
            const firstTrapped = payload.log.type === 'accept' ? '' : `\nFirst Seen At: ${time(dayjs().subtract(payload.log.duration.asMilliseconds(), 'ms').toDate())}`
            const embed: APIEmbed = {
                title: payload.log.type === 'accept' ? 'Endlessh/IP Trapped' : 'Endlessh/IP Disconnected',
                url: `https://db-ip.com/${payload.log.host.address}`,
                description: doubleReturnNewline`
${flag}${payload.log.host.address}${geoDesc}
${trapped}
${firstTrapped}

<https://www.shodan.io/host/${payload.log.host.address}>`
            }
            return embed;
        } catch (e) {
            throw new ErrorWithCause('Unexpected error occurred while generated discord embed contents', {cause: e});
        }
    }
}
