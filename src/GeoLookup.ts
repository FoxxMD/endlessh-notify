import {LRUCache} from "lru-cache";
import {IPDataFields} from "./common/infrastructure/Atomic.js";
import {Address4, Address6} from "ip-address";
import {defaultApiApiQuery, getIpGeolocation} from "./ipApi.js";
import {ErrorWithCause} from "pony-cause";
import {Logger} from "@foxxmd/winston";
import {mergeArr} from "./utils/index.js";

export class GeoLookup {
    cache: LRUCache<string, IPDataFields> = new LRUCache({max: 500})
    logger: Logger

    constructor(logger: Logger) {
        this.logger = logger.child({labels: ['GeoLookup']}, mergeArr)

    }

    getInfo = async (address: Address6 | Address4) => {
        let info = this.cache.get(address.address);
        if (info === undefined) {
            try {
                const resp = await getIpGeolocation(address.address, defaultApiApiQuery.fields);
                if (resp.status === 'fail') {
                    if (resp.message === 'invalid query') {
                        throw new ErrorWithCause(`Unable to get geolocation for '${address.address}' => IP-API responded that IP was invalid`);
                    } else {
                        throw new ErrorWithCause(`Unable to get geolocation for '${address.address}' => IP-API responded with ${resp.message}`);
                    }
                }
                info = resp;
                this.cache.set(address.address, resp);
            } catch (e) {
                throw new ErrorWithCause('Failed to get geolocation', {cause: e});
            }
        }
        return info;
    }
}
