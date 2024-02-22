import {LRUCache} from "lru-cache";
import {IPDataFields} from "./common/infrastructure/Atomic.js";
import {Address4, Address6} from "ip-address";
import {defaultApiApiQuery, getIpGeolocation, IPDataResponse} from "./ipApi.js";
import {ErrorWithCause} from "pony-cause";
import {AppLogger, createChildLogger} from "./common/logging.js";

export class GeoLookup {
    cache: LRUCache<string, IPDataFields> = new LRUCache({max: 500})
    logger: AppLogger

    constructor(logger: AppLogger) {
        this.logger = createChildLogger(logger, 'Geo Lookup'); // logger.child({labels: ['Geo Lookup']}, mergeArr)

    }

    getInfo = async (address: Address6 | Address4) => {
        let info = this.cache.get(address.address);
        if (info === undefined) {
            try {
                const resp = await this.fetchExternalGeolocation(address.address);
                info = resp;
                this.cache.set(address.address, resp);
            } catch (e) {
                throw e;
            }
        } else {
            this.logger.debug(`Got cached geolocation data for ${address.address}`);
        }
        return info;
    }

    async fetchExternalGeolocation(ip: string): Promise<IPDataResponse> {
        // stub for adding additional sources later (different APIs, maxmind, etc...)
        try {
            return this.getIpApiGeolocation(ip);
        } catch (e) {
            throw e;
        }
    }

    async getIpApiGeolocation(ip: string): Promise<IPDataResponse> {
        try {
            const resp = await getIpGeolocation(ip, defaultApiApiQuery.numeric);
            this.logger.debug(`Got geolocation data from ip-api for ${ip}`);
            if (resp.status === 'fail') {
                if (resp.message === 'invalid query') {
                    throw new ErrorWithCause(`Unable to get geolocation for '${ip}' => IP-API responded that IP was invalid`);
                } else {
                    throw new ErrorWithCause(`Unable to get geolocation for '${ip}' => IP-API responded with ${resp.message}`);
                }
            }
            return resp;
        } catch (e) {
            throw new ErrorWithCause(`Failed to get geolocation for ${ip}`, {cause: e});
        }
    }
}
