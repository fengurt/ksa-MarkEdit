import { afterEach, describe, expect, it, vi } from 'vitest';

import { cosAuthorization } from './VaultSyncClient';

describe('COS request signing', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses the hexadecimal SignKey required by Tencent COS', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);

    await expect(cosAuthorization({
      method: 'put',
      host: 'bucket-123.cos.ap-singapore.myqcloud.com',
      path: '/vaults/test/object',
      token: 'session-token',
      secretId: 'AKIDEXAMPLE',
      secretKey: 'secret-key',
    })).resolves.toBe(
      'q-sign-algorithm=sha1&q-ak=AKIDEXAMPLE'
      + '&q-sign-time=1700000000;1700000600&q-key-time=1700000000;1700000600'
      + '&q-header-list=host;x-cos-security-token&q-url-param-list='
      + '&q-signature=4437e6b65aae7c0d7d657c89dbe332f9b24b8d4c',
    );
  });
});
