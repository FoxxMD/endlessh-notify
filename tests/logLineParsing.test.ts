import {before, describe, it} from 'mocha';
import chai, {assert} from 'chai';
import {parseEndlessLogLine, parseToAddress} from "../src/utils/index.js";
import {EndlessCloseOptions, endlessh, endlesshGo} from "./utils/fixtures.js";
import {EndlessCloseLogLine} from "../src/common/infrastructure/Atomic.js";
const should = chai.should();

const endlessFlavors = [{name: 'endlessh', util: endlessh}, {name: 'endless-go', util: endlesshGo}];

describe('Log Line Parsing', function() {

    describe('Line Types', function() {

        describe('ACCEPT', function() {
            for(const {name, util} of endlessFlavors) {
                const [line, opts] = util.accept();
                const parsed = parseEndlessLogLine(line);

                it(`Recognizes ACCEPT line (${name})`, function() {
                    assert.equal(parsed.type, 'accept');
                });

                it(`Has correct timestamp (${name})`, async function () {
                    assert.equal(parsed.time.toISOString(), opts.timestamp.toISOString())
                });

                it(`Has correct host (${name})`, async function () {
                    assert.equal(parsed.host.address, opts.host.address)
                });
            }
        });

        describe('CLOSE', function() {
            for(const {name, util} of endlessFlavors) {
                const [line, opts] = util.close();
                const parsed = parseEndlessLogLine(line) as EndlessCloseLogLine;

                it(`Recognizes CLOSE line (${name})`, function() {
                    assert.equal(parsed.type, 'close');
                });

                it(`Has correct timestamp (${name})`, async function () {
                    assert.equal(parsed.time.toISOString(), opts.timestamp.toISOString())
                });
                it(`Has correct host (${name})`, async function () {
                    assert.equal(parsed.host.address, opts.host.address)
                });
                it(`Has correct duration (${name})`, async function () {
                    assert.equal(parsed.duration.asSeconds(), opts.duration)
                });
            }
        });

    });

    describe('Invalid Data', function() {
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
    });
});


