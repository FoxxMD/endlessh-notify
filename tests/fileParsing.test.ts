import {before, describe, it} from 'mocha';
import chai, {assert} from 'chai';
import asPromised from 'chai-as-promised';
import {patchFs} from '@aleung/fs-monkey';
import {Volume, createFsFromVolume} from "memfs";
import {EndlessFileParser} from "../src/EndlessFileParser.js";
import winstonDef from '@foxxmd/winston';
import {EndlessAcceptOptions, EndlessCloseOptions, endlessh, endlesshGo} from './utils/fixtures.js';
import TailFile from "@logdna/tail-file";
import sinon, {spy} from 'sinon';
import sChai from 'sinon-chai';
import {sleep} from "../src/utils/index.js";
import {EndlessCloseLogLine, EndlessLogLine} from "../src/common/infrastructure/Atomic.js";
import {pEvent} from 'p-event';

chai.use(asPromised);
chai.use(sChai);
const should = chai.should();

const {loggers} = winstonDef;

const vol = new Volume();
const fs = createFsFromVolume(vol);
patchFs(vol);

const logger = loggers.get('noop');

const endlessFlavors = [{name: 'endlessh', util: endlessh}, {name: 'endless-go', util: endlesshGo}];

describe('Log File Interaction', function () {

    describe('File Handling', function() {
        beforeEach(function () {
            vol.reset();
        });

        it('Handles files not found', async function () {
            try {
                await EndlessFileParser.fromFile('/', logger);
            } catch (e) {
                assert.instanceOf(e, Error);
                assert.equal(e.message, 'No log file could be opened!')
            }
        });

        for(const {name, util} of endlessFlavors) {
            const fileName = `/${util.fileName}`;

            it(`Finds ${name} file`, async function () {
                fs.writeFileSync(fileName, util.log());
                await assert.isFulfilled(EndlessFileParser.fromFile('/', logger))
            });
        }
    });

    describe('Log Parsing', function() {
        beforeEach(function () {
            vol.reset();
        });

        describe('Existing log contents', function() {
            for(const {name, util} of endlessFlavors) {
                const fileName = `/${util.fileName}`;
            }
        });

        describe('Existing log contents', function() {
            for(const {name, util} of endlessFlavors) {
                const fileName = `/${util.fileName}`;

                it(`Ignores existing log contents (${name})`, async function () {
                    fs.writeFileSync(fileName, util.log());
                    const spy = sinon.spy();
                    const parser = new EndlessFileParser(new TailFile(fileName, {pollFileIntervalMs: 10}), logger);
                    parser.on('line', spy);
                    await parser.start();
                    await sleep(20);
                    spy.should.not.have.been.called;
                    await parser.stop();
                });
            }
        });

        describe('Unrecognized log lines', function() {
            for(const {name, util} of endlessFlavors) {
                const fileName = `/${util.fileName}`;

                it(`Ignores unrecognized lines (${name})`, async function () {
                    fs.writeFileSync(fileName, util.log());
                    const parser = new EndlessFileParser(new TailFile(fileName, {pollFileIntervalMs: 10}), logger);
                    const spy = sinon.spy();
                    parser.on('line', spy);
                    await parser.start();
                    fs.appendFileSync(fileName, 'I am a junk line!');
                    await sleep(20);
                    spy.should.not.have.been.called;
                    await parser.stop();
                });
            }
        });

        describe('ACCEPT Log Lines', function() {
            for(const {name, util} of endlessFlavors) {
                const fileName = `/${util.fileName}`;

                it(`Recognizes ACCEPT log line (${name})`, async function () {
                    fs.writeFileSync(fileName, util.log());
                    const parser = new EndlessFileParser(new TailFile(fileName, {pollFileIntervalMs: 10}), logger);
                    const log = fs.createWriteStream(fileName, {flags: 'a'});
                    await parser.start();
                    const [line, lineOpts] = util.accept();
                    await sleep(20);
                    const p = pEvent(parser, 'line');
                    log.write(`${line}\n`)
                    const res = await p as EndlessLogLine
                    assert.equal((res as EndlessLogLine).type, 'accept');
                    await parser.stop();
                });

                describe(`ACCEPT Log Lines Parts (${name})`, function() {

                    let res: EndlessLogLine;
                    let opts: Required<EndlessAcceptOptions>;

                    before(async function () {
                        vol.reset();
                        fs.writeFileSync(fileName, util.log());
                        const parser = new EndlessFileParser(new TailFile(fileName, {pollFileIntervalMs: 10}), logger);
                        const log = fs.createWriteStream(fileName, {flags: 'a'});
                        await parser.start();
                        const [line, lineOpts] = util.accept();
                        opts = lineOpts;
                        await sleep(20);
                        const p = pEvent(parser, 'line');
                        log.write(`${line}\n`)
                        res = await p as EndlessLogLine
                        await parser.stop();
                    });

                    it(`Has correct timestamp (${name})`, async function () {
                        assert.equal(res.time.toISOString(), opts.timestamp.toISOString())
                    });
                    it(`Has correct host (${name})`, async function () {
                        assert.equal(res.host.address, opts.host.address)
                    });

                });
            }
        });

        describe('CLOSE Log Lines', function() {
            for(const {name, util} of endlessFlavors) {
                const fileName = `/${util.fileName}`;


                it(`Recognizes CLOSE log line (${name})`, async function () {
                    fs.writeFileSync(fileName, util.log());
                    const parser = new EndlessFileParser(new TailFile(fileName, {pollFileIntervalMs: 10}), logger);
                    const log = fs.createWriteStream(fileName, {flags: 'a'});
                    await parser.start();
                    const [line, lineOpts] = util.close();
                    await sleep(20);
                    const p = pEvent(parser, 'line');
                    log.write(`${line}\n`)
                    const res = await p as EndlessLogLine
                    assert.equal((res as EndlessLogLine).type, 'close');
                    await parser.stop();
                });

                describe(`CLOSE Log Lines Parts (${name})`, function() {

                    let res: EndlessCloseLogLine;
                    let opts: Required<EndlessCloseOptions>;

                    before(async function () {
                        vol.reset();
                        fs.writeFileSync(fileName, util.log());
                        const parser = new EndlessFileParser(new TailFile(fileName, {pollFileIntervalMs: 10}), logger);
                        const log = fs.createWriteStream(fileName, {flags: 'a'});
                        await parser.start();
                        const [line, lineOpts] = util.close();
                        opts = lineOpts;
                        await sleep(20);
                        const p = pEvent(parser, 'line');
                        log.write(`${line}\n`)
                        res = await p as EndlessCloseLogLine
                        await parser.stop();
                    });

                    it(`Has correct timestamp (${name})`, async function () {
                        assert.equal(res.time.toISOString(), opts.timestamp.toISOString())
                    });
                    it(`Has correct host (${name})`, async function () {
                        assert.equal(res.host.address, opts.host.address)
                    });
                    it(`Has correct duration (${name})`, async function () {
                        assert.equal(res.duration.asSeconds(), opts.duration)
                    });

                });
            }
        });
    })
});
