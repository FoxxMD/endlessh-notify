import {before, describe, it} from 'mocha';
import chai, {assert} from 'chai';
import sinon from 'sinon';
import asPromised from 'chai-as-promised';
import sChai from "sinon-chai";
import winstonDef from "@foxxmd/winston";
import {GeoLookup} from "../../src/GeoLookup.js";
import {Address4} from "ip-address";
import {IPDataResponse} from "../../src/ipApi.js";

chai.use(asPromised);
chai.use(sChai);
const should = chai.should();

const {loggers} = winstonDef;
const logger = loggers.get('noop');

const testIp = new Address4('1.1.1.1');

const oneVal: IPDataResponse = {
    status: "success",
    country: "Australia",
    countryCode: "AU",
    regionName: "Queensland",
    city: "South Brisbane",
    lat: -27.4766,
    lon: 153.0166,
    isp: "Cloudflare, Inc"
}

it('Uses cache for repeat addresses', async function () {
    after(function() {
        sinon.restore();
    });
    const lookup = new GeoLookup(logger);

    const fake = sinon.replace(lookup, 'fetchExternalGeolocation', sinon.fake.returns(Promise.resolve(oneVal)))

    await lookup.getInfo(testIp);
    await lookup.getInfo(testIp);
    await lookup.getInfo(testIp);
    assert.equal(fake.callCount, 1)
});
