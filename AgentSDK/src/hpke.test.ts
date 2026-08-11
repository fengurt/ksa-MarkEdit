import {
  Aes256Gcm,
  CipherSuite,
  DhkemP256HkdfSha256,
  HkdfSha256,
} from '@hpke/core';
import { describe, expect, it } from 'vitest';
import { generateAgentIdentity } from './index.js';

describe('Agent HPKE suite', () => {
  it('generates an interoperable P-256 identity', async () => {
    const identity = await generateAgentIdentity();
    expect(identity.privateKeyHex).toMatch(/^[0-9a-f]{64}$/u);
    expect(identity.publicKeyHex).toMatch(/^04[0-9a-f]{128}$/u);
  });

  it('opens P-256/SHA-256/AES-256-GCM capability keys', async () => {
    const suite = new CipherSuite({
      kem: new DhkemP256HkdfSha256(),
      kdf: new HkdfSha256(),
      aead: new Aes256Gcm(),
    });
    const recipientKeys = await suite.kem.generateKeyPair();
    const info = new TextEncoder().encode('ksamint/device-grant/v1');
    const aad = crypto.getRandomValues(new Uint8Array(16));
    const sender = await suite.createSenderContext({
      recipientPublicKey: recipientKeys.publicKey,
      info,
    });
    const recipient = await suite.createRecipientContext({
      recipientKey: recipientKeys.privateKey,
      enc: sender.enc,
      info,
    });
    const key = crypto.getRandomValues(new Uint8Array(32));
    const ciphertext = await sender.seal(key, aad);
    expect(new Uint8Array(await recipient.open(ciphertext, aad))).toEqual(key);
  });
});
