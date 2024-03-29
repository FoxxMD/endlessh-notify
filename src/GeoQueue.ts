import {EndlessLog, EndlessStatLog, IPDataFields} from "./common/infrastructure/Atomic.js";
import {TypedEventEmitter} from "./utils/TypedEventEmitter.js";
import {sleep} from "./utils/index.js";
import {queue, QueueObject} from 'async';
import {GeoLookup} from "./GeoLookup.js";
import {childLogger, Logger} from "@foxxmd/logging";

type GeoHydratedLogLineEvents = {
    'log': [log: EndlessLog]
}

interface GeoTask {
    log: EndlessStatLog
}

export class GeoQueue extends TypedEventEmitter<GeoHydratedLogLineEvents> {

    logger: Logger;
    queue: QueueObject<GeoTask>
    lookup: GeoLookup;

    constructor(logger: Logger) {
        super();
        this.logger = childLogger(logger, 'Geo Queue');// logger.child({labels: ['Geo Queue']}, mergeArr);
        this.lookup = new GeoLookup(this.logger);
        this.queue = this.generateQueue();
        this.queue.error((err, task) => {
            this.logger.warn(err);
        });
    }

    public async push(log: EndlessStatLog) {
        this.queue.push({log});
    }

    protected generateQueue() {
        return queue(async (task: GeoTask, cb) => {
            let geo: IPDataFields | undefined;
            try {
                geo = await this.lookup.getInfo(task.log.host);
                this.emit('log', {...task.log, geo});
            } catch (e) {
                throw e;
            } finally {
                await sleep(1500);
            }
        }, 1);
    }
}
