/**
 * Challenge verification tests
 */

const { assert } = require('chai');
const uuid = require('uuid/v4');
const cts = require('./challtestsrv');
const verify = require('./../src/verify');


describe('verify', () => {
    const challengeTypes = ['http-01', 'dns-01'];

    const testHttp01Authz = { identifier: { type: 'dns', value: `${uuid()}.example.com` } };
    const testHttp01Challenge = { type: 'http-01', status: 'pending', token: uuid() };
    const testHttp01Key = uuid();

    const testDns01Authz = { identifier: { type: 'dns', value: `${uuid()}.example.com` } };
    const testDns01Challenge = { type: 'dns-01', status: 'pending', token: uuid() };
    const testDns01Key = uuid();
    const testDns01Cname = `${uuid()}.example.com`;


    /**
     * Pebble CTS required
     */

    before(function() {
        if (!cts.isEnabled()) {
            this.skip();
        }
    });


    /**
     * API
     */

    it('should expose verification API', async () => {
        assert.containsAllKeys(verify, challengeTypes);
    });


    /**
     * http-01
     */

    describe('http-01', () => {
        it('should reject challenge', async () => {
            await assert.isRejected(verify['http-01'](testHttp01Authz, testHttp01Challenge, testHttp01Key));
        });

        it('should mock challenge response', async () => {
            const resp = await cts.addHttp01ChallengeResponse(testHttp01Challenge.token, testHttp01Key);
            assert.isTrue(resp);
        });

        it('should verify challenge', async () => {
            const resp = await verify['http-01'](testHttp01Authz, testHttp01Challenge, testHttp01Key);
            assert.isTrue(resp);
        });
    });


    /**
     * dns-01
     */

    describe('dns-01', () => {
        it('should reject challenge', async () => {
            await assert.isRejected(verify['dns-01'](testDns01Authz, testDns01Challenge, testDns01Key));
        });

        it('should mock challenge response', async () => {
            const resp = await cts.addDns01ChallengeResponse(`_acme-challenge.${testDns01Authz.identifier.value}.`, testDns01Key);
            assert.isTrue(resp);
        });

        it('should add cname to challenge response', async () => {
            const resp = await cts.setDnsCnameRecord(testDns01Cname, `_acme-challenge.${testDns01Authz.identifier.value}.`);
            assert.isTrue(resp);
        });

        it('should verify challenge', async () => {
            const resp = await verify['dns-01'](testDns01Authz, testDns01Challenge, testDns01Key);
            assert.isTrue(resp);
        });

        it('should verify challenge using cname', async () => {
            const resp = await verify['dns-01'](testDns01Authz, testDns01Challenge, testDns01Key);
            assert.isTrue(resp);
        });
    });
});
