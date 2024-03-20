import TailFile from "@logdna/tail-file";
import {fileIsReadable} from "./utils/io.js";
import {ErrorWithCause} from "pony-cause";
import split2 from 'split2';
import {parseEndlessLogLine} from "./utils/index.js";
import path from "path";
import {EndlessLogLine} from "./common/infrastructure/Atomic.js";
import {TypedEventEmitter} from "./utils/TypedEventEmitter.js";
import {childLogger, Logger} from "@foxxmd/logging";

const endlessFileNames = ['current', 'endlessh.INFO'];

type EndlessFileEventTypes = {
    'line': [line: EndlessLogLine],
    'error': [error: Error]
}

export class EndlessFileParser extends TypedEventEmitter<EndlessFileEventTypes> {

    tailFile: TailFile;
    logger: Logger;

    constructor(file: TailFile, logger: Logger) {
        super();
        this.tailFile = file;
        this.logger = childLogger(logger, 'Parser'); //logger.child({labels: ['Parser']}, mergeArr);
    }

    public async start() {

        this.logger.info('Starting log parsing...');

        this.tailFile.on('tail_error', (err) => {
            this.emit('error', new ErrorWithCause('Encountered error while reading endlessh-go log file', {cause: err}))
        })
            .start()
            .catch((err) => {
                this.emit('error', new ErrorWithCause('Encountered error after starting tail for endlessh-go log file', {cause: err}))
            });

        this.tailFile
            .pipe(split2())
            .on('data', (line) => {
                this.parseLogLine(line);
            })
            .on('truncated', (msg) => {
                this.logger.debug(msg);
            })
            .on('renamed', (msg) => {
            this.logger.debug(msg)
        }).on('retry', (msg) => {
            this.logger.debug(msg)
        });
    }

    public async stop() {
        await this.tailFile.quit();
    }

    protected parseLogLine(line: string) {
        try {
            const parsedLine = parseEndlessLogLine(line);
            if(parsedLine === undefined) {
                this.logger.debug(`Not ACCEPT/CLOSE line => ${line}`);
            } else {
                //this.logger.debug(`Parsed => ${endlessLogLineToFriendly(parsedLine)}`);
                this.emit('line', parsedLine);
            }
        } catch (e) {
            this.logger.warn(new ErrorWithCause(`Could not parse line => ${line}`, {cause: e}));
        }
    }

    public static async fromFile(dir: string, logger: Logger) {
        const cl = childLogger(logger, 'Parser'); // logger.child({labels: ['Parser']}, mergeArr);
        for(const name of endlessFileNames) {
            const filePath = path.resolve(dir, `./${name}`);
            cl.info(`Attempting to open log file => ${filePath}`);
            try {
                await fileIsReadable(filePath);
                cl.info('Found a readable file!');
                return new EndlessFileParser(new TailFile(filePath), logger);
            } catch (e) {
                if(e.message.includes('No file found')) {
                    cl.warn(`No file found`);
                } else {
                    cl.warn(new ErrorWithCause(`Could not open log file`, {cause: e}))
                }
            }
        }
        throw new Error(`No log file could be opened!`);
    }
}
