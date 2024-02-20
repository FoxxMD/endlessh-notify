import {test} from 'tap';
import {EndlessFileParser} from "../../src/EndlessFileParser.js";
import winstonDef from '@foxxmd/winston';
import {endlessh, endlesshGo} from "../utils/fixtures.js";
import TailFile from "@logdna/tail-file";
import '../utils/mochaSetup.js';
import path from "path";
import * as fs from 'fs';
import {sleep} from "../../src/utils/index.js";
import {pEvent} from "p-event";

const {loggers} = winstonDef;

const logger = loggers.get('noop');

const endlessFlavors = [{name: 'endlessh', util: endlessh}, {name: 'endless-go', util: endlesshGo}];

test('Log File Interaction', async (t) => {
    test('File Handling', async (fhTest) => {

        test('Handles files not found', async (notfoundT) => {
            const dir = fhTest.testdir();
            await notfoundT.rejects(EndlessFileParser.fromFile(dir, logger));
        });

        for(const {name, util} of endlessFlavors) {
            test(`Finds ${name} file`, async (foundFileTest) => {
                const dir = foundFileTest.testdir();
                const fileName = path.resolve(dir, util.fileName);
                fs.writeFileSync(fileName, util.log());
                await foundFileTest.resolves(EndlessFileParser.fromFile(dir, logger))
            });
        }

    });

});

test('Log File Parsing', async (_) => {
    for(const {name, util} of endlessFlavors) {
        test(`Ignores existing log contents (${name})`, async (ignores) => {
            const dir = ignores.testdir();
            const fileName = path.resolve(dir, util.fileName);
            fs.writeFileSync(fileName, util.log());
            const parser = new EndlessFileParser(new TailFile(fileName, {pollFileIntervalMs: 10}), logger);
            parser.on('line', () => {
               ignores.fail('Got line when it should not have');
            });
            await parser.start();
            await sleep(20);
            await parser.stop();
        });

        test(`Ignore invalid line (${name})`, async (junk) => {
            const dir = junk.testdir();
            const fileName = path.resolve(dir, util.fileName);
            fs.writeFileSync(fileName, util.log());
            const parser = new EndlessFileParser(new TailFile(fileName, {pollFileIntervalMs: 10}), logger);
            const log = fs.createWriteStream(fileName, {flags: 'a'});
            parser.on('line', () => {
                junk.fail('Emitted junk line when it should not have');
            });
            await parser.start();
            await sleep(20);
            log.write(`I am a junk line\n`);
            await sleep(20);
            await parser.stop();
        });

        test(`Emits on a valid line (${name})`, async (valid) => {
            const dir = valid.testdir();
            const fileName = path.resolve(dir, util.fileName);
            fs.writeFileSync(fileName, util.log());
            const parser = new EndlessFileParser(new TailFile(fileName, {pollFileIntervalMs: 10}), logger);
            const log = fs.createWriteStream(fileName, {flags: 'a'});
            await parser.start();
            await sleep(20);
            const [line, lineOpts] = util.accept();
            const p = pEvent(parser, 'line');
            log.write(`${line}\n`)
            const promRes = await Promise.race([
                p,
                sleep(40)
            ]);
            await parser.stop();
            valid.ok(promRes !== undefined);
        });
    }

});
