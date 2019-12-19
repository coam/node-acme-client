/**
 * Crypto tests
 */

const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');
const { assert } = require('chai');
const forge = require('./../src/crypto/forge');
const openssl = require('./../src/crypto/openssl');

const cryptoEngines = {
    forge,
    openssl
};


describe('crypto', () => {
    let testPemKey;
    let testCert;
    let testSanCert;

    const modulusStore = [];
    const exponentStore = [];
    const publicKeyStore = [];

    const testCsrDomain = 'example.com';
    const testSanCsrDomains = ['example.com', 'test.example.com', 'abc.example.com'];
    const testKeyPath = path.join(__dirname, 'fixtures', 'private.key');
    const testCertPath = path.join(__dirname, 'fixtures', 'certificate.crt');
    const testSanCertPath = path.join(__dirname, 'fixtures', 'san-certificate.crt');


    /**
     * Fixtures
     */

    describe('fixtures', () => {
        it('should read private key fixture', async () => {
            testPemKey = await fs.readFileAsync(testKeyPath);
            assert.isTrue(Buffer.isBuffer(testPemKey));
        });

        it('should read certificate fixture', async () => {
            testCert = await fs.readFileAsync(testCertPath);
            assert.isTrue(Buffer.isBuffer(testCert));
        });

        it('should read SAN certificate fixture', async () => {
            testSanCert = await fs.readFileAsync(testSanCertPath);
            assert.isTrue(Buffer.isBuffer(testSanCert));
        });
    });


    /**
     * Engines
     */

    Object.entries(cryptoEngines).forEach(([name, engine]) => {
        describe(`engine/${name}`, () => {
            let testCsr;
            let testSanCsr;
            let testNonCnCsr;
            let testNonAsciiCsr;


            /**
             * Key generation
             */

            it('should generate a private key', async () => {
                const key = await engine.createPrivateKey();
                assert.isTrue(Buffer.isBuffer(key));
            });

            it('should generate a private key with size=1024', async () => {
                const key = await engine.createPrivateKey(1024);
                assert.isTrue(Buffer.isBuffer(key));
            });

            it('should generate a public key', async () => {
                const key = await engine.createPublicKey(testPemKey);
                assert.isTrue(Buffer.isBuffer(key));
                publicKeyStore.push(key.toString().replace(/[\r\n]/gm, ''));
            });


            /**
             * Certificate Signing Request
             */

            it('should generate a CSR', async () => {
                const [key, csr] = await engine.createCsr({
                    commonName: testCsrDomain
                });

                assert.isTrue(Buffer.isBuffer(key));
                assert.isTrue(Buffer.isBuffer(csr));

                testCsr = csr;
            });

            it('should generate a SAN CSR', async () => {
                const [key, csr] = await engine.createCsr({
                    commonName: testSanCsrDomains[0],
                    altNames: testSanCsrDomains.slice(1, testSanCsrDomains.length)
                });

                assert.isTrue(Buffer.isBuffer(key));
                assert.isTrue(Buffer.isBuffer(csr));

                testSanCsr = csr;
            });

            it('should generate a CSR without common name', async () => {
                const [key, csr] = await engine.createCsr({
                    altNames: testSanCsrDomains
                });

                assert.isTrue(Buffer.isBuffer(key));
                assert.isTrue(Buffer.isBuffer(csr));

                testNonCnCsr = csr;
            });

            it('should generate a non-ASCII CSR', async () => {
                const [key, csr] = await engine.createCsr({
                    commonName: testCsrDomain,
                    organization: '大安區',
                    organizationUnit: '中文部門'
                });

                assert.isTrue(Buffer.isBuffer(key));
                assert.isTrue(Buffer.isBuffer(csr));

                testNonAsciiCsr = csr;
            });

            it('should resolve domains from CSR', async () => {
                const result = await engine.readCsrDomains(testCsr);

                assert.isObject(result);
                assert.isString(result.commonName);
                assert.isArray(result.altNames);
                assert.strictEqual(result.commonName, testCsrDomain);
                assert.deepStrictEqual(result.altNames, [testCsrDomain]);
            });

            it('should resolve domains from SAN CSR', async () => {
                const result = await engine.readCsrDomains(testSanCsr);

                assert.isObject(result);
                assert.isString(result.commonName);
                assert.isArray(result.altNames);
                assert.strictEqual(result.commonName, testSanCsrDomains[0]);
                assert.deepStrictEqual(result.altNames, testSanCsrDomains);
            });

            it('should resolve domains from SAN without common name', async () => {
                const result = await engine.readCsrDomains(testNonCnCsr);

                assert.isObject(result);
                assert.isNull(result.commonName);
                assert.isArray(result.altNames);
                assert.deepStrictEqual(result.altNames, testSanCsrDomains);
            });

            it('should resolve domains from non-ASCII CSR', async () => {
                const result = await engine.readCsrDomains(testNonAsciiCsr);

                assert.isObject(result);
                assert.isString(result.commonName);
                assert.isArray(result.altNames);
                assert.strictEqual(result.commonName, testCsrDomain);
                assert.deepStrictEqual(result.altNames, [testCsrDomain]);
            });


            /**
             * Certificate
             */

            it('should read info from certificate', async () => {
                const info = await engine.readCertificateInfo(testCert);

                assert.isObject(info);

                assert.isObject(info.domains);
                assert.isString(info.domains.commonName);
                assert.isArray(info.domains.altNames);
                assert.strictEqual(info.domains.commonName, testCsrDomain);
                assert.strictEqual(info.domains.altNames.length, 0);

                assert.strictEqual(Object.prototype.toString.call(info.notBefore), '[object Date]');
                assert.strictEqual(Object.prototype.toString.call(info.notAfter), '[object Date]');
            });

            it('should read info from SAN certificate', async () => {
                const info = await engine.readCertificateInfo(testSanCert);

                assert.isObject(info);

                assert.isObject(info.domains);
                assert.isString(info.domains.commonName);
                assert.isArray(info.domains.altNames);
                assert.strictEqual(info.domains.commonName, testSanCsrDomains[0]);
                assert.deepEqual(info.domains.altNames, testSanCsrDomains.slice(1, testSanCsrDomains.length));

                assert.strictEqual(Object.prototype.toString.call(info.notBefore), '[object Date]');
                assert.strictEqual(Object.prototype.toString.call(info.notAfter), '[object Date]');
            });


            /**
             * Modulus and exponent
             */

            it('should get modulus', async () => {
                const result = await Promise.all([testPemKey, testCert, testSanCert].map(async (item) => {
                    const mod = await engine.getModulus(item);
                    assert.isTrue(Buffer.isBuffer(mod));

                    return mod;
                }));

                modulusStore.push(result);
            });

            it('should get public exponent', async () => {
                const result = await Promise.all([testPemKey, testCert, testSanCert].map(async (item) => {
                    const exp = await engine.getPublicExponent(item);
                    assert.isTrue(Buffer.isBuffer(exp));

                    const b64exp = exp.toString('base64');
                    assert.strictEqual(b64exp, 'AQAB');

                    return b64exp;
                }));

                exponentStore.push(result);
            });
        });
    });


    /**
     * Verify identical results
     */

    describe('verification', () => {
        it('should have identical public keys', () => {
            if (publicKeyStore.length > 1) {
                const reference = publicKeyStore.shift();
                publicKeyStore.forEach((item) => assert.strictEqual(reference, item));
            }
        });

        it('should have identical moduli', () => {
            if (modulusStore.length > 1) {
                const reference = modulusStore.shift();
                modulusStore.forEach((item) => assert.deepStrictEqual(reference, item));
            }
        });

        it('should have identical public exponents', () => {
            if (exponentStore.length > 1) {
                const reference = exponentStore.shift();
                exponentStore.forEach((item) => assert.deepStrictEqual(reference, item));
            }
        });
    });
});
