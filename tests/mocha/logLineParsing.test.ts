import {before, describe, it} from 'mocha';
import chai, {assert} from 'chai';
import {parseEndlessLogLine, parseToAddress} from "../../src/utils/index.js";
const should = chai.should();

it('should throw if address is invalid', function () {
    should.throw(() => parseToAddress('junk'));
    should.throw(() => parseToAddress('256.168.0.1'));
    should.throw(() => parseToAddress('192.168.1'));
    should.throw(() => parseToAddress('192.168.0.0/24'));
    should.throw(() => parseToAddress('192.168.0.300'));
    should.throw(() => parseToAddress('fe80:2030:31:24'));
    should.throw(() => parseToAddress('56FE::2159:5BBC::6594'));
});


it('should throw if duration is invalid', function () {
    should.throw(() => parseEndlessLogLine('2024-02-09 17:32:47.600712623  2024-02-09T22:32:47.600Z CLOSE host=::ffff:127.0.0.1 port=52066 fd=4 time=T67 bytes=9'))
});
