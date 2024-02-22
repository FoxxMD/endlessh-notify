import {it} from "mocha";
import chai, {assert} from 'chai';
import {createChildPinoLogger, getPinoLogger} from "../src/common/logging.js";
import {sleep} from "../src/utils/index.js";
import {ErrorWithCause} from "pony-cause";


it('Outputs pino logs as I expect', async function() {
    const logger = await getPinoLogger();
    logger.info({random: true}, 'This has no labels');

    const child = createChildPinoLogger(logger, 'child1');
    child.debug('Has child1 label');

    logger.error({err: new Error('an actual error')}, 'A regular message with a keyed error object');
    logger.error(new Error('an actual error'), 'A regular message with meta as error object');

    const rootError = new Error('This is the root error');
    const causeError = new ErrorWithCause('This is an error with another cause', {cause: rootError});
    const topError = new ErrorWithCause('This is an error with a cause', {cause: causeError});
    child.error(topError);

    child.error(topError, 'Causaul error with additional message');


    logger.addLabel('parentLabel');
    logger.verbose('Has parentLabel');

    child.warn('Does not have parentLabel');

    const deeperChild = createChildPinoLogger(child, ['child2','deep']);
    deeperChild.info('Has child1 child2 and deep');
    deeperChild.error(new Error('Just a plain error'));
    child.error('Only has child1');
    logger.info('Only has parentLabel');

    child.addLabel('childShallow');
    child.info('Has child1 and childShallow');

    deeperChild.info('Does not have childShallow');
    await sleep(100);
});
