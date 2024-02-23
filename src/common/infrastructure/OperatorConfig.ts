import YamlConfigDocument from "../config/YamlConfigDocument.js";
import {LogOptions} from "./Logging.js";
import {WebhookConfig} from "./webhooks.js";

export class YamlOperatorConfigDocument extends YamlConfigDocument<OperatorConfig> {

}

export interface OperatorFileConfig {
    document: YamlOperatorConfigDocument
    isWriteable?: boolean
}

export interface OperatorConfigWithFileContext extends OperatorConfig {
    fileConfig: OperatorFileConfig
}

export interface OperatorConfig extends OperatorJsonConfig {
}


export interface OperatorJsonConfig {
    logging?: LogOptions,
    notifiers: WebhookConfig[]
    endlessDir?: string
    mapquestKey?: string
}
