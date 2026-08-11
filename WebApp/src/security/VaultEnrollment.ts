import {
  approveDeviceEnrollment,
  createDeviceEnrollment,
  deviceEnrollmentStatus,
  exchangeDeviceSession,
  listVaultDevices,
  registerDevice,
  recoverDeviceEnrollment,
  type DeviceSession,
  type PendingDeviceEnrollment,
  type VaultDevice,
} from '../api/client';
import {
  hpkeOpenP256,
  hpkeSealP256,
  decodeSignedDeviceGrant,
  signDeviceGrant,
  verifySignedDeviceGrant,
  vaultUUIDBytes,
} from './vaultProtocol';
import {
  loadOrCreateVaultIdentity,
  loadVaultSyncState,
  markVaultIdentityAuthorized,
  replaceVaultMasterKey,
  saveVaultSyncState,
} from './VaultKeyStore';
import { decodeRecoveryPackage } from './VaultRecovery';

const SESSION_PROOF_DOMAIN = 'ksamint/device-session/v1';

export class DeviceEnrollmentRequiredError extends Error {
  constructor(public readonly enrollment: PendingDeviceEnrollment & { vaultId: string }) {
    super(`Authorize this device with code ${enrollment.verificationCode}`);
    this.name = 'DeviceEnrollmentRequiredError';
  }
}

export async function ensureVaultDeviceSession({
  workspaceId,
  vaultId,
}: {
  workspaceId: string;
  vaultId: string;
}): Promise<DeviceSession> {
  let identity = await loadOrCreateVaultIdentity(workspaceId);
  const state = await loadVaultSyncState(workspaceId);
  const catalog = await listVaultDevices(vaultId);
  const existing = catalog.devices.find(device => device.id === identity.deviceId);
  if (existing) {
    if (!identity.syncAuthorized) await markVaultIdentityAuthorized(workspaceId);
    return exchange(identity, vaultId);
  }

  if (catalog.devices.length === 0) {
    const session = await registerFirstDevice(identity, vaultId);
    await markVaultIdentityAuthorized(workspaceId);
    return session;
  }

  if (state.enrollmentRequestId) {
    const status = await deviceEnrollmentStatus(vaultId, state.enrollmentRequestId);
    if (status.status === 'approved' && status.signedGrant) {
      const authorizer = authorizerForGrant(status.signedGrant, catalog.devices);
      const signed = await verifySignedDeviceGrant({
        value: unbase64(status.signedGrant),
        authorizerSigningPublicKey: unbase64(authorizer.signingPublicKey),
      });
      if (signed.grant.deviceId !== identity.deviceId) {
        throw new Error('The approved grant belongs to another device');
      }
      const masterKey = await hpkeOpenP256({
        recipientPrivateKey: identity.agreementPrivateKey,
        recipientPublicKey: await rawPublicKey(identity.agreementPublicKey),
        envelope: signed.grant.wrappedMasterKey,
        aad: vaultUUIDBytes(signed.grant.grantId),
      });
      try {
        await replaceVaultMasterKey(workspaceId, masterKey, true);
      } finally {
        masterKey.fill(0);
      }
      state.enrollmentRequestId = undefined;
      await saveVaultSyncState(workspaceId, state);
      identity = await loadOrCreateVaultIdentity(workspaceId);
      return exchange(identity, vaultId);
    }
    if (status.status === 'pending') {
      throw new DeviceEnrollmentRequiredError(status);
    }
    state.enrollmentRequestId = undefined;
    await saveVaultSyncState(workspaceId, state);
  }

  const enrollment = await createDeviceEnrollment({
    vaultId,
    deviceId: identity.deviceId,
    displayName: deviceDisplayName(),
    hpkePublicKey: base64(await rawPublicKey(identity.agreementPublicKey)),
    signingPublicKey: base64(await rawPublicKey(identity.signingPublicKey)),
  });
  await requireMatchingVerificationCode(enrollment);
  state.enrollmentRequestId = enrollment.requestId;
  await saveVaultSyncState(workspaceId, state);
  throw new DeviceEnrollmentRequiredError(enrollment);
}

export async function approvePendingEnrollment({
  workspaceId,
  vaultId,
  enrollment,
}: {
  workspaceId: string;
  vaultId: string;
  enrollment: PendingDeviceEnrollment;
}): Promise<void> {
  const identity = await loadOrCreateVaultIdentity(workspaceId);
  await requireMatchingVerificationCode(enrollment);
  const devices = await listVaultDevices(vaultId);
  if (!devices.devices.some(device => device.id === identity.deviceId)) {
    throw new Error('Only an authorized Vault device can approve enrollment');
  }
  const grantId = crypto.randomUUID();
  const wrappedMasterKey = await hpkeSealP256({
    recipientPublicKey: unbase64(enrollment.hpkePublicKey),
    plaintext: identity.masterKey,
    aad: vaultUUIDBytes(grantId),
  });
  const signedGrant = await signDeviceGrant({
    authorizerDeviceId: identity.deviceId,
    signingKey: identity.signingPrivateKey,
    grant: {
      grantId,
      deviceId: enrollment.deviceId,
      deviceHpkePublicKey: unbase64(enrollment.hpkePublicKey),
      deviceSigningPublicKey: unbase64(enrollment.signingPublicKey),
      permission: 'read_write',
      keyVersion: 1,
      createdUnixMs: Date.now(),
      wrappedMasterKey,
    },
  });
  await approveDeviceEnrollment(vaultId, enrollment.requestId, base64(signedGrant));
}

export async function recoverVaultFromPackage({
  workspaceId,
  packageJSON,
}: {
  workspaceId: string;
  packageJSON: string;
}): Promise<void> {
  const { recoveryPackage, masterKey } = await decodeRecoveryPackage(packageJSON);
  const state = await loadVaultSyncState(workspaceId);
  if (state.vaultId && state.vaultId !== recoveryPackage.vaultId) {
    masterKey.fill(0);
    throw new Error('This workspace is already linked to another Vault');
  }
  try {
    await replaceVaultMasterKey(workspaceId, masterKey, false);
    const identity = await loadOrCreateVaultIdentity(workspaceId);
    const hpkePublicKey = await rawPublicKey(identity.agreementPublicKey);
    const signingPublicKey = await rawPublicKey(identity.signingPublicKey);
    const enrollment = await createDeviceEnrollment({
      vaultId: recoveryPackage.vaultId,
      deviceId: identity.deviceId,
      displayName: deviceDisplayName(),
      hpkePublicKey: base64(hpkePublicKey),
      signingPublicKey: base64(signingPublicKey),
    });
    const grantId = crypto.randomUUID();
    const wrappedMasterKey = await hpkeSealP256({
      recipientPublicKey: hpkePublicKey,
      plaintext: masterKey,
      aad: vaultUUIDBytes(grantId),
    });
    const signedGrant = await signDeviceGrant({
      authorizerDeviceId: identity.deviceId,
      signingKey: identity.signingPrivateKey,
      grant: {
        grantId,
        deviceId: identity.deviceId,
        deviceHpkePublicKey: hpkePublicKey,
        deviceSigningPublicKey: signingPublicKey,
        permission: 'read_write',
        keyVersion: 1,
        createdUnixMs: Date.now(),
        wrappedMasterKey,
      },
    });
    await recoverDeviceEnrollment(
      recoveryPackage.vaultId,
      enrollment.requestId,
      recoveryPackage.recoveryToken,
      base64(signedGrant),
    );
    await replaceVaultMasterKey(workspaceId, masterKey, true);
    state.vaultId = recoveryPackage.vaultId;
    state.enrollmentRequestId = undefined;
    state.recoveryConfigured = true;
    await saveVaultSyncState(workspaceId, state);
  } finally {
    masterKey.fill(0);
  }
}

async function registerFirstDevice(
  identity: Awaited<ReturnType<typeof loadOrCreateVaultIdentity>>,
  vaultId: string,
): Promise<DeviceSession> {
  const unixMs = Date.now();
  const signingPublicKey = await rawPublicKey(identity.signingPublicKey);
  const hpkePublicKey = await rawPublicKey(identity.agreementPublicKey);
  return registerDevice({
    vaultId,
    deviceId: identity.deviceId,
    displayName: deviceDisplayName(),
    hpkePublicKey: base64(hpkePublicKey),
    signingPublicKey: base64(signingPublicKey),
    wrappedGrant: base64(identity.wrappedMasterKey),
    unixMs,
    proof: base64(await signSessionProof(identity.signingPrivateKey, vaultId, identity.deviceId, unixMs)),
  });
}

async function exchange(
  identity: Awaited<ReturnType<typeof loadOrCreateVaultIdentity>>,
  vaultId: string,
): Promise<DeviceSession> {
  const unixMs = Date.now();
  return exchangeDeviceSession({
    vaultId,
    deviceId: identity.deviceId,
    unixMs,
    signature: base64(await signSessionProof(
      identity.signingPrivateKey,
      vaultId,
      identity.deviceId,
      unixMs,
    )),
  });
}

async function signSessionProof(
  signingKey: CryptoKey,
  vaultId: string,
  deviceId: string,
  unixMs: number,
): Promise<Uint8Array> {
  const proof = new TextEncoder().encode(
    `${SESSION_PROOF_DOMAIN}:${vaultId}:${deviceId}:${unixMs}`,
  );
  return new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    signingKey,
    proof,
  ));
}

function authorizerForGrant(value: string, devices: VaultDevice[]): VaultDevice {
  const signed = (() => {
    try {
      return decodeGrantAuthorizer(unbase64(value));
    } catch {
      throw new Error('The approved device grant is malformed');
    }
  })();
  const authorizer = devices.find(device => device.id === signed);
  if (!authorizer || authorizer.revokedAt) {
    throw new Error('The authorizing device is unavailable or revoked');
  }
  return authorizer;
}

function decodeGrantAuthorizer(value: Uint8Array): string {
  // The protocol decoder validates the complete canonical shape; signature verification follows.
  return decodeSignedDeviceGrant(value).authorizerDeviceId;
}

async function rawPublicKey(key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.exportKey('raw', key));
}

function deviceDisplayName(): string {
  const platform = navigator.platform || 'Web';
  return `ksamint Web · ${platform}`.slice(0, 80);
}

function base64(value: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < value.length; offset += 0x8000) {
    binary += String.fromCharCode(...value.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function unbase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), character => character.charCodeAt(0));
}

async function requireMatchingVerificationCode(enrollment: PendingDeviceEnrollment): Promise<void> {
  const bytes = new Uint8Array([
    ...vaultUUIDBytes(enrollment.requestId),
    ...vaultUUIDBytes(enrollment.deviceId),
    ...unbase64(enrollment.hpkePublicKey),
    ...unbase64(enrollment.signingPublicKey),
  ]);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const number = new DataView(digest.buffer, digest.byteOffset, 4).getUint32(0) % 100_000_000;
  if (number.toString().padStart(8, '0') !== enrollment.verificationCode) {
    throw new Error('The enrollment verification code does not match the device public keys');
  }
}
