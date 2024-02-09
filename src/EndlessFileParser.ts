import TailFile from "@logdna/tail-file";
import {fileIsReadable} from "./utils/io.js";
import {ErrorWithCause} from "pony-cause";
import {Logger} from "@foxxmd/winston";
import {EventEmitter} from "events";
import split2 from 'split2';
import {endlessLogLineToFriendly, mergeArr, parseEndlessLogLine} from "./utils/index.js";
import {pEvent} from 'p-event';

export class EndlessFileParser extends EventEmitter {

    tailFile: TailFile;
    logger: Logger;

    constructor(file: TailFile, logger: Logger) {
        super();
        this.tailFile = file;
        this.logger = logger.child({labels: ['Parser']}, mergeArr);
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
            });

        await pEvent(this.tailFile, 'close');
    }

    protected parseLogLine(line: string) {
        try {
            const parsedLine = parseEndlessLogLine(line);
            if(parsedLine === undefined) {
                this.logger.debug(`Not ACCEPT/CLOSE line => ${line}`);
            } else {
                this.logger.debug(`Parsed => ${endlessLogLineToFriendly(parsedLine)}`);
                this.emit('line', parsedLine);
            }
        } catch (e) {
            this.logger.warn(new ErrorWithCause(`Could not parse line => ${line}`, {cause: e}));
        }
    }

    public static async fromFile(path: string, logger: Logger) {
        const childLogger = logger.child({labels: ['Parser']}, mergeArr);
        childLogger.info(`Attempting to open log file => ${path}`);
        try {
            await fileIsReadable(path);
        } catch (e) {
            throw new ErrorWithCause('Could not open endlessh-go log file', {cause: e});
        }
        return new EndlessFileParser(new TailFile(path), logger);
    }
}
