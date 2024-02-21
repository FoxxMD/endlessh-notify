import {it} from "mocha";
import chai, {assert} from 'chai';
import {createChildLogger, getPinoLogger} from "../src/common/logging.js";
import {sleep} from "../src/utils/index.js";

/**
 * Can't use this yet because Pino does not support mixed sync/async logging
 *
 * IE synchronous to console AND async to file
 *
 * It also does not support multi transport sync -- only async
 * https://github.com/pinojs/pino/issues/1260
 * https://github.com/pinojs/pino/issues/1532
 * */
it('Outputs pino logs as I expect', async function() {
    const logger = getPinoLogger();
    logger.info('This has no labels');

    const child = createChildLogger(logger, 'child1');
    child.info('Has child1 label');

    logger.addLabel('parentLabel');
    logger.info('Has parentLabel');

    child.info('Does not have parentLabel');

    const deeperChild = createChildLogger(child, ['child2','deep']);
    deeperChild.info('Has child1 child2 and deep');
    child.info('Only has child1');
    logger.info('Only has parentLabel');

    child.addLabel('childShallow');
    child.info('Has child1 and childShallow');

    deeperChild.info('Does not have childShallow');
    await sleep(100);
});
