import {configDir, projectDir} from "../index.js";
import {readFileToString} from "../../utils/io.js";
import {ErrorWithCause} from "pony-cause";
import {parseFromYamlToObject} from "./ConfigUtil.js";
import {
    OperatorConfig,
    OperatorJsonConfig,
    YamlOperatorConfigDocument
} from "../infrastructure/OperatorConfig.js";
import {Document as YamlDocument} from "yaml";
import * as operatorSchema from '../schema/operator.json';
import merge from 'deepmerge';
import {Schema} from 'ajv';
import * as AjvNS from 'ajv';
import Ajv from 'ajv';
import {LogLevel} from "../infrastructure/Atomic.js";
import {overwriteMerge} from "../../utils/index.js";
import {AppLogger, getPinoLogger, initPinoLogger} from "../logging.js";
import {DiscordConfig, GotifyConfig, NtfyConfig, WebhookConfig} from "../infrastructure/webhooks.js";
import path from "path";

export const createAjvFactory = (logger: AppLogger): AjvNS.default => {
    const validator =  new Ajv.default({logger: logger, verbose: true, strict: "log", allowUnionTypes: true});
    // https://ajv.js.org/strict-mode.html#unknown-keywords
    validator.addKeyword('deprecationMessage');
    return validator;
}

export const validateJson = <T>(config: object, schema: Schema, logger: AppLogger): T => {
    const ajv = createAjvFactory(logger);
    const valid = ajv.validate(schema, config);
    if (valid) {
        return config as unknown as T;
    } else {
        logger.error('config was not valid. Please use schema to check validity.', {leaf: 'Config'});
        if (Array.isArray(ajv.errors)) {
            for (const err of ajv.errors) {
                let parts = [
                    `At: ${err.instancePath}`,
                ];
                let data;
                if (typeof err.data === 'string') {
                    data = err.data;
                } else if (err.data !== null && typeof err.data === 'object' && (err.data as any).name !== undefined) {
                    data = `Object named '${(err.data as any).name}'`;
                }
                if (data !== undefined) {
                    parts.push(`Data: ${data}`);
                }
                let suffix = '';
                
                if (err.params.allowedValues !== undefined) {
                    
                    suffix = err.params.allowedValues.join(', ');
                    suffix = ` [${suffix}]`;
                }
                parts.push(`${err.keyword}: ${err.schemaPath} => ${err.message}${suffix}`);

                // if we have a reference in the description parse it out so we can log it here for context
                if (err.parentSchema !== undefined && err.parentSchema.description !== undefined) {
                    const desc = err.parentSchema.description as string;
                    const seeIndex = desc.indexOf('[See]');
                    if (seeIndex !== -1) {
                        let newLineIndex: number | undefined = desc.indexOf('\n', seeIndex);
                        if (newLineIndex === -1) {
                            newLineIndex = undefined;
                        }
                        const seeFragment = desc.slice(seeIndex + 5, newLineIndex);
                        parts.push(`See:${seeFragment}`);
                    }
                }

                logger.error(`Schema Error:\r\n${parts.join('\r\n')}`, {leaf: 'Config'});
            }
        }
        throw new ErrorWithCause('Config schema validity failure');
    }
}

export const parseConfigFromSources = async (operatorDir: string) => {

    const initLogger = initPinoLogger;

    let configDoc: YamlOperatorConfigDocument
    
    let configFromFile: OperatorJsonConfig = {notifiers: []}

    const operatorConfig = path.resolve(operatorDir, `./config.yaml`);

    let rawConfig = '';
    try {
        rawConfig = await readFileToString(operatorConfig, {throwOnNotFound: false}) ?? '';
    } catch (e) {
        throw new ErrorWithCause('Could not read config file', {cause: e});
    }

    const [format, doc, yamlErr] = parseFromYamlToObject(rawConfig, {
        location: operatorConfig
    });

    if (doc === undefined && rawConfig !== '') {
        initLogger.error(`Could not parse file contents at ${operatorConfig} as YAML:`);
        initLogger.error(yamlErr);
        throw new ErrorWithCause(`Could not parse file contents at ${operatorConfig} as YAML`);
    } else if (doc === undefined && rawConfig === '') {
        // create an empty doc
        configDoc = new YamlOperatorConfigDocument('', operatorConfig);
        configDoc.parsed = new YamlDocument({});
        
        configFromFile = {notifiers: []};
    } else {
        configDoc = doc as (YamlOperatorConfigDocument);

        try {
            configFromFile = validateJson(configDoc.toJS(), operatorSchema, initLogger) as OperatorJsonConfig;
        } catch (err: any) {
            initLogger.error('Cannot continue app startup because operator config file was not valid.');
            throw err;
        }
    }

    const mergedConfig = merge.all([parseConfigFromEnv(), configFromFile], {
        arrayMerge: overwriteMerge,
    }) as OperatorJsonConfig;

    if(mergedConfig.endlessDir === undefined) {
        mergedConfig.endlessDir = path.resolve(projectDir, `./endlessData`)
    }

    return mergedConfig as OperatorConfig;
}

export const parseConfigFromEnv = (): OperatorJsonConfig => {

    const notifiers: WebhookConfig[] = [];

    const debounceInterval = process.env.DEBOUNCE_INTERVAL ?? '1 hour';

    const discordWebhook = process.env.DISCORD_WEBHOOK;
    if(discordWebhook !== undefined) {
        const dHook: DiscordConfig = {
            webhook: discordWebhook,
            type: 'discord',
            debounceInterval,
        };
        notifiers.push(dHook)
    }

    const ntfyUrl = process.env.NTFY_URL;
    if(ntfyUrl !== undefined) {
        const nHook: NtfyConfig = {
            type: 'ntfy',
            url: ntfyUrl,
            topic: process.env.NTFY_TOPIC,
            username: process.env.NTFY_USER,
            password: process.env.NTFY_PASS,
            debounceInterval,
        }
        notifiers.push(nHook)
    }

    const gotifyUrl = process.env.GOTIFY_URL;
    if(gotifyUrl !== undefined) {
        const gHook: GotifyConfig = {
            type: 'gotify',
            url: gotifyUrl,
            token: process.env.GOTIFY_TOKEN,
            debounceInterval,
        }
        notifiers.push(gHook);
    }

    return {
        logging: {
            level: process.env.LOG_LEVEL as (LogLevel | undefined)
        },
        endlessDir: process.env.ENDLESS_DIR,
        mapquestKey: process.env.MAPQUEST_KEY,
        notifiers
    }
}
