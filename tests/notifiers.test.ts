import {before, describe, it} from 'mocha';
import chai, {assert} from 'chai';
import sinon from 'sinon';
import {Notifiers} from "../src/notifier/Notifiers.js";
import winstonDef from "@foxxmd/winston";

const {loggers} = winstonDef;
const logger = loggers.get('noop');

const should = chai.should();

describe('Mapquest', function() {
    it('should not return an image if no key is present', async function() {
        after(function() {
           sinon.restore();
        });
        const notifiers = new Notifiers(logger);
        const fake = sinon.replace(notifiers, 'fetchMapquestImage', sinon.fake.returns(Promise.resolve(Buffer.from('this is junk', 'utf-8'))));
        const res = await notifiers.getMapquestImage(1,2);
        assert.isUndefined(res);
    });
    it('should cache image result', async function() {
        after(function() {
            sinon.restore();
        });
        const notifiers = new Notifiers(logger, '1234');
        const fake = sinon.replace(notifiers, 'fetchMapquestImage', sinon.fake.returns(Promise.resolve(Buffer.from('this is junk', 'utf-8'))));
        await notifiers.getMapquestImage(1,2);
        await notifiers.getMapquestImage(1,2);
        await notifiers.getMapquestImage(1,2);
        assert.equal(fake.callCount, 1);
    });
})
