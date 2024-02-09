import AbstractConfigDocument from "./AbstractConfigDocument.js";
import {Document as YamlDocument} from "yaml";

export interface ConfigToObjectOptions {
    location?: string,
    yamlDocFunc?: (content: string, location?: string) => AbstractConfigDocument<YamlDocument>
    allowArrays?: boolean
}
