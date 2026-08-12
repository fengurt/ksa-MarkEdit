import { describe, expect, it } from 'vitest';
import { decodeCreationOptions, decodeRequestOptions } from './client';

function bytes(value: BufferSource): number[] {
  return [...new Uint8Array(value as ArrayBuffer)];
}

describe('WebAuthn option decoding', () => {
  it('unwraps the registration publicKey envelope and decodes binary fields', () => {
    const decoded = decodeCreationOptions({
      publicKey: {
        challenge: 'AQID',
        rp: { name: 'kmd' },
        user: {
          id: 'BAUG',
          name: 'user-example',
          displayName: 'kmd',
        },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      },
    });

    expect(bytes(decoded.publicKey!.challenge)).toEqual([1, 2, 3]);
    expect(bytes(decoded.publicKey!.user.id)).toEqual([4, 5, 6]);
  });

  it('unwraps the authentication publicKey envelope and preserves mediation', () => {
    const decoded = decodeRequestOptions({
      mediation: 'required',
      publicKey: {
        challenge: 'BwgJ',
        allowCredentials: [{ type: 'public-key', id: 'CgsM' }],
      },
    });

    expect(decoded.mediation).toBe('required');
    expect(bytes(decoded.publicKey!.challenge)).toEqual([7, 8, 9]);
    expect(bytes(decoded.publicKey!.allowCredentials![0].id)).toEqual([10, 11, 12]);
  });
});
