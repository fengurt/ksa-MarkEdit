const API_BASE = import.meta.env.VITE_API_BASE || 'https://api.notes.apuch.cn';

export type VaultSummary = {
  id: string;
  displayName: string;
  syncSequence: number;
};

export type LatestManifest = {
  sequence: number;
  previousDigest?: string;
  digest: string;
  signedCbor: string;
};

export type TemporaryCosGrant = {
  protocolVersion: number;
  bucket: string;
  region: string;
  prefix: string;
  expiration?: string;
  credentials: {
    Token: string;
    TmpSecretId: string;
    TmpSecretKey: string;
  };
};

export type VaultObjectSummary = {
  objectId: string;
  kind: 'markdown' | 'attachment' | 'vector_shard' | 'manifest';
  cipherSize: number;
  digest: string;
  sequence: number;
  objectKey: string;
};

type PublicKeyOptionsJSON = Omit<
  PublicKeyCredentialCreationOptions,
  'challenge' | 'user' | 'excludeCredentials'
> & {
  challenge: string;
  user: Omit<PublicKeyCredentialUserEntity, 'id'> & { id: string };
  excludeCredentials?: Array<Omit<PublicKeyCredentialDescriptor, 'id'> & { id: string }>;
};

type PublicKeyRequestOptionsJSON = Omit<
  PublicKeyCredentialRequestOptions,
  'challenge' | 'allowCredentials'
> & {
  challenge: string;
  allowCredentials?: Array<Omit<PublicKeyCredentialDescriptor, 'id'> & { id: string }>;
};

export async function createPasskey(): Promise<void> {
  const options = await apiRequest<PublicKeyOptionsJSON>('/api/v1/passkeys/register/options', {
    method: 'POST',
  });
  const credential = await navigator.credentials.create({
    publicKey: {
      ...options,
      challenge: fromBase64URL(options.challenge),
      user: { ...options.user, id: fromBase64URL(options.user.id) },
      excludeCredentials: options.excludeCredentials?.map(item => ({
        ...item,
        id: fromBase64URL(item.id),
      })),
    },
  });
  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error('Passkey creation was cancelled');
  }
  await apiRequest('/api/v1/passkeys/register/verify', {
    method: 'POST',
    body: JSON.stringify(credentialJSON(credential)),
  });
}

export async function signInWithPasskey(): Promise<void> {
  const options = await apiRequest<PublicKeyRequestOptionsJSON>(
    '/api/v1/passkeys/authenticate/options',
    { method: 'POST' },
  );
  const credential = await navigator.credentials.get({
    publicKey: {
      ...options,
      challenge: fromBase64URL(options.challenge),
      allowCredentials: options.allowCredentials?.map(item => ({
        ...item,
        id: fromBase64URL(item.id),
      })),
    },
  });
  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error('Passkey sign-in was cancelled');
  }
  await apiRequest('/api/v1/passkeys/authenticate/verify', {
    method: 'POST',
    body: JSON.stringify(credentialJSON(credential)),
  });
}

export async function listVaults(): Promise<VaultSummary[]> {
  return apiRequest('/api/v1/vaults', { method: 'GET' });
}

export async function createVault(displayName: string): Promise<{ id: string }> {
  return apiRequest('/api/v1/vaults', {
    method: 'POST',
    body: JSON.stringify({ display_name: displayName }),
  });
}

export async function latestManifest(vaultId: string): Promise<LatestManifest | undefined> {
  try {
    return await apiRequest(`/api/v1/vaults/${vaultId}/manifest`, { method: 'GET' });
  } catch (error) {
    if (error instanceof AccountServiceError && error.status === 404) {
      return undefined;
    }
    throw error;
  }
}

export async function registerDevice({
  vaultId,
  deviceId,
  hpkePublicKey,
  signingPublicKey,
  wrappedGrant,
}: {
  vaultId: string;
  deviceId: string;
  hpkePublicKey: string;
  signingPublicKey: string;
  wrappedGrant: string;
}): Promise<void> {
  await apiRequest(`/api/v1/vaults/${vaultId}/devices/${deviceId}`, {
    method: 'PUT',
    body: JSON.stringify({ hpkePublicKey, signingPublicKey, wrappedGrant }),
  });
}

export async function registerObject({
  vaultId,
  objectId,
  kind,
  cipherSize,
  digest,
}: {
  vaultId: string;
  objectId: string;
  kind: 'markdown' | 'attachment' | 'vector_shard' | 'manifest';
  cipherSize: number;
  digest: string;
}): Promise<{ objectKey: string }> {
  return apiRequest(`/api/v1/vaults/${vaultId}/objects`, {
    method: 'POST',
    body: JSON.stringify({ objectId, kind, cipherSize, digest }),
  });
}

export async function listVaultObjects(vaultId: string): Promise<VaultObjectSummary[]> {
  const objects: VaultObjectSummary[] = [];
  let after = 0;
  for (;;) {
    const page = await apiRequest<VaultObjectSummary[]>(
      `/api/v1/vaults/${vaultId}/objects?after=${after}&limit=500`,
      { method: 'GET' },
    );
    objects.push(...page);
    if (page.length < 500) {
      return objects;
    }
    const next = page.at(-1)?.sequence ?? after;
    if (next <= after) {
      throw new Error('Object catalog cursor did not advance');
    }
    after = next;
  }
}

export async function requestTemporaryCosGrant(vaultId: string): Promise<TemporaryCosGrant> {
  return apiRequest(`/api/v1/vaults/${vaultId}/sts`, { method: 'POST' });
}

export async function uploadManifest({
  vaultId,
  sequence,
  previousDigest,
  digest,
  signedCbor,
}: {
  vaultId: string;
  sequence: number;
  previousDigest?: string;
  digest: string;
  signedCbor: string;
}): Promise<void> {
  await apiRequest(`/api/v1/vaults/${vaultId}/manifest`, {
    method: 'PUT',
    body: JSON.stringify({ sequence, previousDigest, digest, signedCbor }),
  });
}

export async function requestGitHubToken(vaultId: string): Promise<{
  token: string;
  expiresAt: string;
  repository: string;
}> {
  return apiRequest(`/api/v1/vaults/${vaultId}/github/token`, { method: 'POST' });
}

export class AccountServiceError extends Error {
  constructor(public readonly status: number) {
    super(`Account service returned ${status}`);
  }
}

export async function apiRequest<T = unknown>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  if (!response.ok) {
    throw new AccountServiceError(response.status);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

function credentialJSON(credential: PublicKeyCredential): unknown {
  const response = credential.response;
  const assertion = response instanceof AuthenticatorAssertionResponse ? response : undefined;
  return {
    id: credential.id,
    rawId: toBase64URL(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment,
    response: response instanceof AuthenticatorAttestationResponse
      ? {
        clientDataJSON: toBase64URL(response.clientDataJSON),
        attestationObject: toBase64URL(response.attestationObject),
        transports: response.getTransports(),
      }
      : {
        clientDataJSON: toBase64URL(response.clientDataJSON),
        authenticatorData: assertion ? toBase64URL(assertion.authenticatorData) : '',
        signature: assertion ? toBase64URL(assertion.signature) : '',
        userHandle: assertion?.userHandle ? toBase64URL(assertion.userHandle) : null,
      },
  };
}

function fromBase64URL(value: string): ArrayBuffer {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(
    Math.ceil(value.length / 4) * 4,
    '=',
  );
  return Uint8Array.from(atob(base64), character => character.charCodeAt(0)).buffer;
}

function toBase64URL(value: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(value));
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
