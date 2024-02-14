import {before, describe, it} from 'mocha';
import chai, {assert} from 'chai';
import sinon from 'sinon';
import {Notifiers} from "../src/notifier/Notifiers.js";
import winstonDef, {Logger} from "@foxxmd/winston";
import {AbstractWebhookNotifier} from "../src/notifier/AbstractWebhookNotifier.js";
import {WebhookConfig, WebhookPayload} from '../src/common/infrastructure/webhooks.js';
import dayjs from "dayjs";
import {Address4} from "ip-address";
import {sleep} from "../src/utils/index.js";
import {DiscordWebhookNotifier} from "../src/notifier/DiscordWebhookNotifier.js";
import {MapImageService} from "../src/MapImageService.js";

const {loggers} = winstonDef;
const logger = loggers.get('noop');

const should = chai.should();

class TestNotifier extends AbstractWebhookNotifier {

    constructor(type: string, defaultName: string, config: WebhookConfig, logger: Logger) {
        super(type, defaultName, config, logger);
        this.initialized = true;
    }

    doNotify = async (payload: WebhookPayload) => {
        return true;
    };

}

const payloadAccept: WebhookPayload = {
    priority: 'info',
    mapImageData: Buffer.from('this is junk', 'utf-8'),
    log: {
        type: 'accept',
        time: dayjs(),
        host: new Address4('1.1.1.1'),
        geo: {
            country: "Australia",
            countryCode: "AU",
            regionName: "Queensland",
            city: "South Brisbane",
            lat: -27.4766,
            lon: 153.0166,
            isp: "Cloudflare, Inc"
        },
        stats: {
            firstSeen: dayjs().subtract(1, 'minute'),
            connections: 2,
            time: dayjs.duration(30, 's')
        }
    }
}

const payloadClose: WebhookPayload = {
    ...payloadAccept,
    log: {
        ...payloadAccept.log,
        type: 'close',
        duration: dayjs.duration(10, 's')
    }
}

describe('Mapquest', function () {
    it('should not return an image if no key is present', async function () {
        after(function () {
            sinon.restore();
        });
        const imageService = new MapImageService(logger);
        const fake = sinon.replace(imageService, 'fetchMapquestImage', sinon.fake.returns(Promise.resolve(Buffer.from('this is junk', 'utf-8'))));
        const res = await imageService.getImage(1, 2);
        assert.isUndefined(res);
    });
    it('should cache image result', async function () {
        after(function () {
            sinon.restore();
        });
        const imageService = new MapImageService(logger, '1234');
        const fake = sinon.replace(imageService, 'fetchMapquestImage', sinon.fake.returns(Promise.resolve(Buffer.from('this is junk', 'utf-8'))));
        await imageService.getImage(1, 2);
        await imageService.getImage(1, 2);
        await imageService.getImage(1, 2);
        assert.equal(fake.callCount, 1);
    });
});

describe('ACCEPT Notifiers', function () {

    describe('DOES send', function () {
        it('if not seen before', async function () {
            const notif = new TestNotifier('test', 'test', {
                type: 'discord',
                events: [
                    {
                        type: 'accept',
                        debounceInterval: '5 seconds'
                    }
                ],
                webhook: 'test'
            }, logger);
            assert.isTrue(await notif.notify(payloadAccept));
        });

        it('was last seen after longer than TTL', async function () {
            const notif = new TestNotifier('test', 'test', {
                type: 'discord',
                events: [
                    {
                        type: 'accept',
                        debounceInterval: '50 milliseconds'
                    }
                ],
                webhook: 'test'
            }, logger);
            assert.isTrue(await notif.notify(payloadAccept));
            await sleep(60);
            assert.isTrue(await notif.notify(payloadAccept));
        });

        it('if ANY event matches', async function () {
            const notif = new TestNotifier('test', 'test', {
                type: 'discord',
                events: [
                    {
                        type: 'accept',
                        debounceInterval: '5 seconds'
                    },
                    {
                        type: 'accept',
                        debounceInterval: '50 milliseconds'
                    }
                ],
                webhook: 'test'
            }, logger);
            assert.isTrue(await notif.notify(payloadAccept));
            await sleep(60);
            assert.isTrue(await notif.notify(payloadAccept));
        });

    });

    describe('DOES NOT send', function () {
        it('if seen within TTL', async function () {
            const notif = new TestNotifier('test', 'test', {
                type: 'discord',
                events: [
                    {
                        type: 'accept',
                        debounceInterval: '5 seconds'
                    }
                ],
                webhook: 'test'
            }, logger);
            assert.isTrue(await notif.notify(payloadAccept));
            await sleep(100);
            assert.isUndefined(await notif.notify(payloadAccept));
        });
        it('if total connections above max', async function () {
            const notif = new TestNotifier('test', 'test', {
                type: 'discord',
                events: [
                    {
                        type: 'accept',
                        maxTotalConnections: 1
                    }
                ],
                webhook: 'test'
            }, logger);
            assert.isUndefined(await notif.notify(payloadAccept));
        });
        it('if total connections below min', async function () {
            const notif = new TestNotifier('test', 'test', {
                type: 'discord',
                events: [
                    {
                        type: 'accept',
                        minTotalConnections: 3
                    }
                ],
                webhook: 'test'
            }, logger);
            assert.isUndefined(await notif.notify(payloadAccept));
        });
    });
});

describe('CLOSE Notifiers', function () {

    describe('DOES NOT send', function () {
        it('if seen within TTL', async function () {
            const notif = new TestNotifier('test', 'test', {
                type: 'discord',
                events: [
                    {
                        type: 'close',
                        debounceInterval: '5 seconds'
                    }
                ],
                webhook: 'test'
            }, logger);
            assert.isTrue(await notif.notify(payloadClose));
            await sleep(100);
            assert.isUndefined(await notif.notify(payloadClose));
        });

        it('if trapped time below min', async function () {
            const notif = new TestNotifier('test', 'test', {
                type: 'discord',
                events: [
                    {
                        type: 'close',
                        debounceInterval: '5 seconds',
                        minTrappedTime: '15 seconds'
                    }
                ],
                webhook: 'test'
            }, logger);
            assert.isUndefined(await notif.notify(payloadClose));
        });

        it('if total trapped time below min', async function () {
            const notif = new TestNotifier('test', 'test', {
                type: 'discord',
                events: [
                    {
                        type: 'close',
                        debounceInterval: '5 seconds',
                        minTrappedTime: '40 seconds'
                    }
                ],
                webhook: 'test'
            }, logger);
            assert.isUndefined(await notif.notify(payloadClose));
        });

        it('if trapped time above max', async function () {
            const notif = new TestNotifier('test', 'test', {
                type: 'discord',
                events: [
                    {
                        type: 'close',
                        debounceInterval: '5 seconds',
                        maxTrappedTime: '8 seconds'
                    }
                ],
                webhook: 'test'
            }, logger);
            assert.isUndefined(await notif.notify(payloadClose));
        });

        it('if total trapped time above max', async function () {
            const notif = new TestNotifier('test', 'test', {
                type: 'discord',
                events: [
                    {
                        type: 'close',
                        debounceInterval: '5 seconds',
                        maxTotalTrappedTime: '20 seconds'
                    }
                ],
                webhook: 'test'
            }, logger);
            assert.isUndefined(await notif.notify(payloadClose));
        });

        it('if total connections above max', async function () {
            const notif = new TestNotifier('test', 'test', {
                type: 'discord',
                events: [
                    {
                        type: 'close',
                        debounceInterval: '5 seconds',
                        maxTotalConnections: 1
                    }
                ],
                webhook: 'test'
            }, logger);
            assert.isUndefined(await notif.notify(payloadClose));
        });

        it('if total connections below min', async function () {
            const notif = new TestNotifier('test', 'test', {
                type: 'discord',
                events: [
                    {
                        type: 'close',
                        debounceInterval: '5 seconds',
                        minTotalConnections: 3
                    }
                ],
                webhook: 'test'
            }, logger);
            assert.isUndefined(await notif.notify(payloadClose));
        });
    });

    describe('DOES send', function () {

        it('if not seen before', async function () {
            const notif = new TestNotifier('test', 'test', {
                type: 'discord',
                events: [
                    {
                        type: 'close',
                        debounceInterval: '5 seconds'
                    }
                ],
                webhook: 'test'
            }, logger);
            assert.isTrue(await notif.notify(payloadClose));
        });

        it('was last seen after longer than TTL', async function () {
            const notif = new TestNotifier('test', 'test', {
                type: 'discord',
                events: [
                    {
                        type: 'close',
                        debounceInterval: '50 milliseconds'
                    }
                ],
                webhook: 'test'
            }, logger);
            assert.isTrue(await notif.notify(payloadClose));
            await sleep(60);
            assert.isTrue(await notif.notify(payloadClose));
        });

        it('if trapped time above min', async function () {
            const notif = new TestNotifier('test', 'test', {
                type: 'discord',
                events: [
                    {
                        type: 'close',
                        debounceInterval: '5 seconds',
                        minTrappedTime: '7 seconds'
                    }
                ],
                webhook: 'test'
            }, logger);
            assert.isTrue(await notif.notify(payloadClose));
        });

        it('if trapped time below max', async function () {
            const notif = new TestNotifier('test', 'test', {
                type: 'discord',
                events: [
                    {
                        type: 'close',
                        debounceInterval: '5 seconds',
                        maxTrappedTime: '15 seconds'
                    }
                ],
                webhook: 'test'
            }, logger);
            assert.isTrue(await notif.notify(payloadClose));
        });

        it('if ANY event matches', async function () {
            const notif = new TestNotifier('test', 'test', {
                type: 'discord',
                events: [
                    {
                        type: 'close',
                        debounceInterval: '5 seconds',
                        maxTrappedTime: '6 seconds'
                    },
                    {
                        type: 'close',
                        debounceInterval: '5 seconds',
                    }
                ],
                webhook: 'test'
            }, logger);
            assert.isTrue(await notif.notify(payloadClose));
        });
    });

});

describe('Discord', function() {
   it('generates expected ACCEPT embed', function () {
       const embed = DiscordWebhookNotifier.generateEmbed(payloadAccept);
       assert.equal(embed.title,'Endlessh/IP Trapped')
       assert.isFalse(new RegExp(/Trapped for \*\*/i).test(embed.description));
   });
    it('generated expected CLOSE embed', function () {
        const embed = DiscordWebhookNotifier.generateEmbed(payloadClose);
        assert.equal(embed.title,'Endlessh/IP Disconnected')
        assert.isTrue(new RegExp(/Trapped for \*\*/i).test(embed.description));
        assert.isTrue(new RegExp(/First Seen At:/i).test(embed.description));
    });
});
