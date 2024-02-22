import {before, describe, it} from 'mocha';
import chai, {assert} from 'chai';
import asPromised from 'chai-as-promised';
import {EndlessFileParser} from "../src/EndlessFileParser.js";
import winstonDef from '@foxxmd/winston';
import {endlessh, endlesshGo} from './utils/fixtures.js';
import TailFile from "@logdna/tail-file";
import sinon, {spy} from 'sinon';
import sChai from 'sinon-chai';
import {sleep} from "../src/utils/index.js";
import {pEvent} from 'p-event';
import * as fs from 'fs';
import withLocalTmpDir from 'with-local-tmp-dir';
import {testPinoLogger} from "../src/common/logging.js";

chai.use(asPromised);
chai.use(sChai);
const should = chai.should();

const {loggers} = winstonDef;

const logger = testPinoLogger; // loggers.get('noop');

const endlessFlavors = [{name: 'endlessh', util: endlessh}, {name: 'endless-go', util: endlesshGo}];
const defaultFlavor = endlessFlavors[0];

describe('Log File Interaction', function () {

    it('Handles files not found', async function () {
        await withLocalTmpDir(async () => {
            await assert.isRejected(EndlessFileParser.fromFile('.', logger), /No log file could be opened!/i);
        });
    });

    describe('Finds file', function () {
        for (const {name, util} of endlessFlavors) {
            const fileName = `${util.fileName}`;

            it(`Finds ${name} file`, async function () {
                await withLocalTmpDir(async () => {
                    fs.writeFileSync(fileName, util.log());
                    await assert.isFulfilled(EndlessFileParser.fromFile('.', logger));
                });
            });
        }
    });

    it('Ignores existing log contents', async function () {
        const {util} = defaultFlavor;
        const fileName = `${util.fileName}`;

        await withLocalTmpDir(async () => {
            fs.writeFileSync(fileName, util.log());
            const spy = sinon.spy();
            const parser = new EndlessFileParser(new TailFile(fileName, {pollFileIntervalMs: 10}), logger);
            parser.on('line', spy);
            await parser.start();
            await sleep(20);
            spy.should.not.have.been.called;
            await parser.stop();
        });
    });

    it('Emits on new line', async function () {
        const {util} = defaultFlavor;
        const fileName = `${util.fileName}`;
        await withLocalTmpDir(async () => {
            fs.writeFileSync(fileName, util.log());
            const parser = new EndlessFileParser(new TailFile(fileName, {pollFileIntervalMs: 10}), logger);
            const log = fs.createWriteStream(fileName, {flags: 'a'});
            await parser.start();
            const [line, lineOpts] = util.accept();
            await sleep(20);
            const p = pEvent(parser, 'line');
            log.write(`${line}\n`)
            const res = await Promise.race([
                p,
                sleep(40)
            ])
            await parser.stop();
            assert.isTrue(res !== undefined);
        });
    });

    it('Ignores unrecognized new lines', async function () {
        const {util} = defaultFlavor;
        const fileName = `${util.fileName}`;
        await withLocalTmpDir(async () => {
            fs.writeFileSync(fileName, util.log());
            const parser = new EndlessFileParser(new TailFile(fileName, {pollFileIntervalMs: 10}), logger);
            const log = fs.createWriteStream(fileName, {flags: 'a'});
            await parser.start();
            const [line, lineOpts] = util.accept();
            await sleep(20);
            const p = pEvent(parser, 'line');
            log.write(`JUNK\n`)
            const res = await Promise.race([
                p,
                sleep(30)
            ])
            await parser.stop();
            assert.isTrue(res === undefined);
        });
    });
});
