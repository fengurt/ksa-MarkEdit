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

export type VaultDevice = {
  id: string;
  displayName: string;
  keyVersion: number;
  signingPublicKey: string;
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
};

export type PendingDeviceEnrollment = {
  requestId: string;
  deviceId: string;
  displayName: string;
  verificationCode: string;
  hpkePublicKey: string;
  signingPublicKey: string;
  expiresAt: string;
};

export type DeviceEnrollmentStatus = PendingDeviceEnrollment & {
  vaultId: string;
  status: 'pending' | 'approved' | 'consumed' | 'rejected' | 'expired';
  signedGrant?: string;
};

export type DeviceSession = { token: string; expiresAt: string };

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

type CreationOptionsResponseJSON = {
  publicKey: PublicKeyOptionsJSON;
};

type RequestOptionsResponseJSON = {
  publicKey: PublicKeyRequestOptionsJSON;
  mediation?: CredentialMediationRequirement;
};

export function decodeCreationOptions(
  response: CreationOptionsResponseJSON,
): CredentialCreationOptions {
  const options = response?.publicKey;
  if (
    !options
    || typeof options.challenge !== 'string'
    || typeof options.user?.id !== 'string'
  ) {
    throw new Error('Account service returned invalid Passkey registration options');
  }
  return {
    publicKey: {
      ...options,
      challenge: fromBase64URL(options.challenge),
      user: { ...options.user, id: fromBase64URL(options.user.id) },
      excludeCredentials: options.excludeCredentials?.map(item => ({
        ...item,
        id: fromBase64URL(item.id),
      })),
    },
  };
}

export function decodeRequestOptions(
  response: RequestOptionsResponseJSON,
): CredentialRequestOptions {
  const options = response?.publicKey;
  if (!options || typeof options.challenge !== 'string') {
    throw new Error('Account service returned invalid Passkey authentication options');
  }
  return {
    mediation: response.mediation,
    publicKey: {
      ...options,
      challenge: fromBase64URL(options.challenge),
      allowCredentials: options.allowCredentials?.map(item => ({
        ...item,
        id: fromBase64URL(item.id),
      })),
    },
  };
}

export async function createPasskey(): Promise<void> {
  const response = await apiRequest<CreationOptionsResponseJSON>('/api/v1/passkeys/register/options', {
    method: 'POST',
  });
  const credential = await navigator.credentials.create(decodeCreationOptions(response));
  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error('Passkey creation was cancelled');
  }
  await apiRequest('/api/v1/passkeys/register/verify', {
    method: 'POST',
    body: JSON.stringify(credentialJSON(credential)),
  });
}

export async function signInWithPasskey(): Promise<void> {
  const response = await apiRequest<RequestOptionsResponseJSON>(
    '/api/v1/passkeys/authenticate/options',
    { method: 'POST' },
  );
  const credential = await navigator.credentials.get(decodeRequestOptions(response));
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

export async function latestManifest(
  vaultId: string,
  deviceToken: string,
): Promise<LatestManifest | undefined> {
  try {
    return await deviceRequest(`/api/v1/vaults/${vaultId}/manifest`, deviceToken, { method: 'GET' });
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
  displayName,
  unixMs,
  proof,
}: {
  vaultId: string;
  deviceId: string;
  hpkePublicKey: string;
  signingPublicKey: string;
  wrappedGrant: string;
  displayName: string;
  unixMs: number;
  proof: string;
}): Promise<DeviceSession> {
  return apiRequest(`/api/v1/vaults/${vaultId}/devices/${deviceId}`, {
    method: 'PUT',
    body: JSON.stringify({
      hpkePublicKey, signingPublicKey, wrappedGrant, displayName, unixMs, proof,
    }),
  });
}

export async function exchangeDeviceSession({
  vaultId,
  deviceId,
  unixMs,
  signature,
}: {
  vaultId: string;
  deviceId: string;
  unixMs: number;
  signature: string;
}): Promise<DeviceSession> {
  return apiRequest('/api/v1/device-sessions/exchange', {
    method: 'POST',
    body: JSON.stringify({ vaultId, deviceId, unixMs, signature }),
  });
}

export async function listVaultDevices(vaultId: string): Promise<{
  devices: VaultDevice[];
  pending: PendingDeviceEnrollment[];
}> {
  return apiRequest(`/api/v1/vaults/${vaultId}/devices`, { method: 'GET' });
}

export async function createDeviceEnrollment({
  vaultId,
  deviceId,
  displayName,
  hpkePublicKey,
  signingPublicKey,
}: {
  vaultId: string;
  deviceId: string;
  displayName: string;
  hpkePublicKey: string;
  signingPublicKey: string;
}): Promise<PendingDeviceEnrollment & { vaultId: string }> {
  return apiRequest(`/api/v1/vaults/${vaultId}/enrollments`, {
    method: 'POST',
    body: JSON.stringify({ deviceId, displayName, hpkePublicKey, signingPublicKey }),
  });
}

export async function deviceEnrollmentStatus(
  vaultId: string,
  requestId: string,
): Promise<DeviceEnrollmentStatus> {
  return apiRequest(`/api/v1/vaults/${vaultId}/enrollments/${requestId}`, { method: 'GET' });
}

export async function approveDeviceEnrollment(
  vaultId: string,
  requestId: string,
  signedGrant: string,
): Promise<void> {
  await apiRequest(`/api/v1/vaults/${vaultId}/enrollments/${requestId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ signedGrant }),
  });
}

export async function recoverDeviceEnrollment(
  vaultId: string,
  requestId: string,
  recoveryToken: string,
  signedGrant: string,
): Promise<void> {
  await apiRequest(`/api/v1/vaults/${vaultId}/enrollments/${requestId}/recover`, {
    method: 'POST',
    body: JSON.stringify({ recoveryToken, signedGrant }),
  });
}

export async function rejectDeviceEnrollment(vaultId: string, requestId: string): Promise<void> {
  await apiRequest(`/api/v1/vaults/${vaultId}/enrollments/${requestId}`, { method: 'DELETE' });
}

export async function revokeVaultDevice(vaultId: string, deviceId: string): Promise<void> {
  await apiRequest(`/api/v1/vaults/${vaultId}/devices/${deviceId}`, { method: 'DELETE' });
}

export async function renameVaultDevice(
  vaultId: string,
  deviceId: string,
  displayName: string,
): Promise<void> {
  await apiRequest(`/api/v1/vaults/${vaultId}/devices/${deviceId}`, {
    method: 'PATCH',
    body: JSON.stringify({ displayName }),
  });
}

export async function registerObject({
  vaultId,
  objectId,
  kind,
  cipherSize,
  digest,
  deviceToken,
}: {
  vaultId: string;
  objectId: string;
  kind: 'markdown' | 'attachment' | 'vector_shard' | 'manifest';
  cipherSize: number;
  digest: string;
  deviceToken: string;
}): Promise<{ objectKey: string }> {
  return deviceRequest(`/api/v1/vaults/${vaultId}/objects`, deviceToken, {
    method: 'POST',
    body: JSON.stringify({ objectId, kind, cipherSize, digest }),
  });
}

export async function listVaultObjects(
  vaultId: string,
  deviceToken: string,
): Promise<VaultObjectSummary[]> {
  const objects: VaultObjectSummary[] = [];
  let after = 0;
  for (;;) {
    const page = await deviceRequest<VaultObjectSummary[]>(
      `/api/v1/vaults/${vaultId}/objects?after=${after}&limit=500`,
      deviceToken,
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

export async function requestTemporaryCosGrant(
  vaultId: string,
  deviceToken: string,
): Promise<TemporaryCosGrant> {
  return deviceRequest(`/api/v1/vaults/${vaultId}/sts`, deviceToken, { method: 'POST' });
}

export async function setVaultRecoveryToken(
  vaultId: string,
  deviceToken: string,
  recoveryToken: string,
): Promise<void> {
  await deviceRequest(`/api/v1/vaults/${vaultId}/recovery`, deviceToken, {
    method: 'PUT',
    body: JSON.stringify({ recoveryToken }),
  });
}

export async function uploadManifest({
  vaultId,
  sequence,
  previousDigest,
  digest,
  signedCbor,
  deviceToken,
}: {
  vaultId: string;
  sequence: number;
  previousDigest?: string;
  digest: string;
  signedCbor: string;
  deviceToken: string;
}): Promise<void> {
  await deviceRequest(`/api/v1/vaults/${vaultId}/manifest`, deviceToken, {
    method: 'PUT',
    body: JSON.stringify({ sequence, previousDigest, digest, signedCbor }),
  });
}

export type GitHubBackupSnapshot = { commit: string; sequence: number; createdAt: string };

export async function configureGitHubBackup({
  vaultId,
  deviceToken,
  installationId,
  owner,
  repository,
}: {
  vaultId: string;
  deviceToken: string;
  installationId: number;
  owner: string;
  repository: string;
}): Promise<void> {
  await deviceRequest(`/api/v1/vaults/${vaultId}/github`, deviceToken, {
    method: 'PUT',
    body: JSON.stringify({ installationId, owner, repository }),
  });
}

export async function triggerGitHubBackup(vaultId: string, deviceToken: string): Promise<void> {
  await deviceRequest(`/api/v1/vaults/${vaultId}/github/backups`, deviceToken, { method: 'POST' });
}

export async function listGitHubBackups(vaultId: string, deviceToken: string): Promise<{
  backups: GitHubBackupSnapshot[];
  pending?: { sequence: number; notBefore: string; attempts: number; lastError?: string };
}> {
  return deviceRequest(`/api/v1/vaults/${vaultId}/github/backups`, deviceToken, { method: 'GET' });
}

export async function githubBackupCatalog(vaultId: string, commit: string, deviceToken: string): Promise<{
  protocolVersion: 1;
  sequence: number;
  manifestDigest: string;
  signedManifest: string;
  objects: VaultObjectSummary[];
}> {
  return deviceRequest(`/api/v1/vaults/${vaultId}/github/backups/${commit}/catalog`, deviceToken, { method: 'GET' });
}

export async function githubBackupObject(
  vaultId: string,
  commit: string,
  objectId: string,
  deviceToken: string,
): Promise<{ objectId: string; ciphertext: string }> {
  return deviceRequest(
    `/api/v1/vaults/${vaultId}/github/backups/${commit}/objects/${objectId}`,
    deviceToken,
    { method: 'GET' },
  );
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

async function deviceRequest<T = unknown>(
  path: string,
  deviceToken: string,
  init: RequestInit,
): Promise<T> {
  return apiRequest<T>(path, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${deviceToken}` },
  });
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
