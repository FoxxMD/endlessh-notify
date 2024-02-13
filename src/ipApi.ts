import got from 'got';
import {ErrorWithCause} from "pony-cause";
import {IPDataFields} from "./common/infrastructure/Atomic.js";

export const getIpGeolocation = async (ip: string, fields?: IPDataFields[keyof IPDataFields][] | number): Promise<IPDataResponse> => {
    let query = '';
    if (Array.isArray(fields)) {
        query = `?fields=${fields.join(',')}`
    } else if (typeof fields === 'number') {
        query = `?fields=${fields}`
    }
    try {
        return await got.get(`http://ip-api.com/json/${ip}${query}`, {
            timeout: {
                request: 5000
            }
        }).json<IPDataResponse>();
    } catch (e) {
        throw new ErrorWithCause('Request to ip-api failed', {cause: e});
    }
}



export interface IPDataResponse extends IPDataFields {
    /**
     * Whether the request was successful
     */
    status: "success" | 'fail'

    message?: 'private range' | 'reserved range' | 'invalid query'
}

export const defaultApiApiQuery = {
    fields: ['status','message','country','countryCode','region','regionName','city','lat','lon','isp'],
    numeric: 49887
}
