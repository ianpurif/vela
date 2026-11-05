import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, it } from "vitest";

const runNode = promisify(execFile);

async function runCommonJs(source: string) {
  // Normal Node 24 interop masks the CommonJS/ESM crash seen in serverless runtimes.
  const { stdout } = await runNode(
    process.execPath,
    ["--no-experimental-require-module", "--input-type=commonjs", "-e", source],
    { timeout: 10000, cwd: process.cwd() },
  );
  return stdout.trim();
}

it("loads the Firebase Admin entry points without require(ESM) support", async () => {
  const result = await runCommonJs(`
    const assert = require('node:assert/strict');
    const { initializeApp, deleteApp } = require('firebase-admin/app');
    const { getAuth } = require('firebase-admin/auth');
    const { getFirestore } = require('firebase-admin/firestore');
    const { getAppCheck } = require('firebase-admin/app-check');
    (async () => {
      const app = initializeApp({ projectId: 'demo-vela-runtime' });
      assert.equal(typeof getAuth(app).verifySessionCookie, 'function');
      assert.equal(typeof getFirestore(app).runTransaction, 'function');
      assert.equal(typeof getAppCheck(app).verifyToken, 'function');
      await deleteApp(app);
      console.log('Firebase Admin loaded');
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `);
  expect(result).toBe("Firebase Admin loaded");
});

it("converts RSA and EC JWKS into working verification keys through Firebase's dependency", async () => {
  const result = await runCommonJs(`
    const assert = require('node:assert/strict');
    const { createRequire } = require('node:module');
    const { generateKeyPairSync, sign, verify } = require('node:crypto');
    const adminRequire = createRequire(require.resolve('firebase-admin/auth'));
    const jwksRsa = adminRequire('jwks-rsa');
    (async () => {
      for (const [type, options, alg] of [
        ['rsa', { modulusLength: 2048 }, 'RS256'],
        ['ec', { namedCurve: 'P-256' }, 'ES256'],
      ]) {
        const { publicKey, privateKey } = generateKeyPairSync(type, options);
        const jwk = { ...publicKey.export({ format: 'jwk' }), kid: alg, use: 'sig', alg };
        const client = jwksRsa({
          jwksUri: 'https://unused.invalid/jwks',
          cache: false,
          rateLimit: false,
          getKeysInterceptor: async () => [jwk],
        });
        const resolved = await client.getSigningKey(alg);
        const data = Buffer.from('VELA runtime compatibility');
        const signature = sign('sha256', data, privateKey);
        assert.equal(resolved.getPublicKey(), publicKey.export({ format: 'pem', type: 'spki' }));
        assert.equal(verify('sha256', data, resolved.getPublicKey(), signature), true);
        assert.equal(verify('sha256', Buffer.from('altered'), resolved.getPublicKey(), signature), false);
      }
      console.log('JWKS verification passed');
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `);
  expect(result).toBe("JWKS verification passed");
});
