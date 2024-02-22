import TailFile from "@logdna/tail-file";
import {fileIsReadable} from "./utils/io.js";
import {ErrorWithCause} from "pony-cause";
import {Logger} from "@foxxmd/winston";
import {EventEmitter} from "events";
import split2 from 'split2';
import {endlessLogLineToFriendly, mergeArr, parseEndlessLogLine} from "./utils/index.js";
import {pEvent} from 'p-event';
import path from "path";
import {EndlessLogLine} from "./common/infrastructure/Atomic.js";
import {TypedEventEmitter} from "./utils/TypedEventEmitter.js";
import {AppLogger, createChildLogger} from "./common/logging.js";

const endlessFileNames = ['current', 'endlessh.INFO'];

type EndlessFileEventTypes = {
    'line': [line: EndlessLogLine],
    'error': [error: Error]
}

export class EndlessFileParser extends TypedEventEmitter<EndlessFileEventTypes> {

    tailFile: TailFile;
    logger: AppLogger;

    constructor(file: TailFile, logger: AppLogger) {
        super();
        this.tailFile = file;
        this.logger = createChildLogger(logger, 'Parser'); //logger.child({labels: ['Parser']}, mergeArr);
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

    public static async fromFile(dir: string, logger: AppLogger) {
        const childLogger = createChildLogger(logger, 'Parser'); // logger.child({labels: ['Parser']}, mergeArr);
        for(const name of endlessFileNames) {
            const filePath = path.resolve(dir, `./${name}`);
            childLogger.info(`Attempting to open log file => ${filePath}`);
            try {
                await fileIsReadable(filePath);
                childLogger.info('Found a readable file!');
                return new EndlessFileParser(new TailFile(filePath), logger);
            } catch (e) {
                if(e.message.includes('No file found')) {
                    childLogger.warn(`No file found`);
                } else {
                    childLogger.warn(new ErrorWithCause(`Could not open log file`, {cause: e}))
                }
            }
        }
        throw new Error(`No log file could be opened!`);
    }
}
