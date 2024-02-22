import {Logger} from "@foxxmd/winston";
import {LRUCache} from "lru-cache";
import {mergeArr} from "./utils/index.js";
import {ErrorWithCause} from "pony-cause";
import got from 'got';
import {AppLogger, createChildLogger} from "./common/logging.js";

export class MapImageService {

    mapquestKey?: string;
    imageCache: LRUCache<string, Buffer> = new LRUCache({max: 100});
    logger: AppLogger;

    constructor(logger: AppLogger, mapquestKey?: string) {
        this.logger = createChildLogger(logger, 'Map Image'); // logger.child({labels: ['Map Image']}, mergeArr);
        this.mapquestKey = mapquestKey;
        if (this.mapquestKey !== undefined) {
            this.logger.info('Mapquest Key found. Will generate map images for Discord notifiers.');
        } else {
            this.logger.info('No Mapquest Key found. Will NOT generate map images for Discord notifiers.');
        }
    }

    getImage = async (lat: number, long: number): Promise<Buffer | undefined> => {
        if(this.mapquestKey === undefined) {
            return undefined;
        }

        const latlong = `${lat.toString()},${long.toString()}`;
        let data = this.imageCache.get(latlong);
        if (data === undefined) {
            try {
                data = await this.fetchMapquestImage(lat, long);
                this.imageCache.set(latlong, data);
            } catch (e) {
                this.logger.warn(e);
                return undefined;
            }
        } else {
            this.logger.debug(`Got cached image data for ${latlong}`)
        }
        return data;
    }

    async fetchMapquestImage(lat: number, long: number): Promise<Buffer | undefined> {
        const latlong = `${lat.toString()},${long.toString()}`;
        try {
            this.logger.debug(`Getting Mapquest Image => https://www.mapquestapi.com/staticmap/v5/map?center=${latlong}&size=500,300}`);
            return await got.get(`https://www.mapquestapi.com/staticmap/v5/map?center=${latlong}&size=500,300&key=${this.mapquestKey}`).buffer();
        } catch (e) {
            throw new ErrorWithCause(`Failed to get mapquest image for ${latlong}`, {cause: e})
        }
    }
}
