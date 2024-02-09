import {EndlessLog} from "./Atomic.js";

export interface WebhookPayload {
    log: EndlessLog
    priority?: 'info' | 'warn' | 'error'
    mapImageData?: string
}

export interface PrioritiesConfig {
    /**
     * @examples [5]
     * */
    info: number
    /**
     * @examples [7]
     * */
    warn: number
    /**
     * @examples [10]
     * */
    error: number
}

export interface CommonWebhookConfig {
    /**
     * Webhook type. Valid values are:
     *
     * * gotify
     * * ntfy
     *
     * @examples ["gotify"]
     * */
    type: 'gotify' | 'ntfy' | 'discord'
    /**
     * A friendly name used to identify webhook config in logs
     * */
    name?: string
    debounceInterval?: string
}

export interface GotifyConfig extends CommonWebhookConfig {
    type: 'gotify'
    /**
     * The URL of the Gotify server. Same URL that would be used to reach the Gotify UI
     *
     * @examples ["http://192.168.0.100:8078"]
     * */
    url: string
    /**
     * The token created for this Application in Gotify
     *
     * @examples ["AQZI58fA.rfSZbm"]
     * */
    token: string
    /**
     * Priority of messages
     *
     * * Info -> 5
     * * Warn -> 7
     * * Error -> 10
     * */
    priorities?: PrioritiesConfig
}

export interface NtfyConfig extends CommonWebhookConfig {
    type: 'ntfy'
    /**
     * The URL of the Ntfy server
     *
     * @examples ["http://192.168.0.100:8078"]
     * */
    url: string

    /**
     * The topic we should POST to
     * */
    topic: string

    /**
     * Required if topic is protected
     * */
    username?: string
    /**
     * Required if topic is protected
     * */
    password?: string

    /**
     * Priority of messages
     *
     * * Info -> 3
     * * Warn -> 4
     * * Error -> 5
     * */
    priorities?: PrioritiesConfig
}

export interface DiscordConfig extends CommonWebhookConfig {
    type: 'discord'
    webhook: string
}

export type WebhookConfig = GotifyConfig | NtfyConfig | DiscordConfig;
