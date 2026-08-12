import { setVaultRecoveryToken } from '../api/client';
import { loadOrCreateVaultIdentity, getOrCreateRecoveryToken, loadVaultSyncState, saveVaultSyncState } from './VaultKeyStore';

export type RecoveryPackageV2 = {
  protocolVersion: 2;
  vaultId: string;
  recoveryPhrase: string;
  recoveryToken: string;
  createdAt: string;
  checksum: string;
};

export type RecoveryChallenge = { position: number; expected: string };

export class VaultRecoverySetupRequiredError extends Error {
  constructor(
    public readonly recoveryPackage: RecoveryPackageV2,
    public readonly challenge: RecoveryChallenge[],
    public readonly deviceToken: string,
  ) {
    super('Download and verify the Vault recovery package before the first encrypted sync');
    this.name = 'VaultRecoverySetupRequiredError';
  }
}

export async function prepareRecoveryPackage(
  workspaceId: string,
  vaultId: string,
): Promise<{ recoveryPackage: RecoveryPackageV2; challenge: RecoveryChallenge[] }> {
  const [{ entropyToMnemonic }, { wordlist }] = await Promise.all([
    import('@scure/bip39'),
    import('@scure/bip39/wordlists/english.js'),
  ]);
  const identity = await loadOrCreateVaultIdentity(workspaceId);
  const recoveryToken = await getOrCreateRecoveryToken(workspaceId);
  const recoveryPhrase = entropyToMnemonic(identity.masterKey, wordlist);
  const packageWithoutChecksum = {
    protocolVersion: 2 as const,
    vaultId,
    recoveryPhrase,
    recoveryToken: base64(recoveryToken),
    createdAt: new Date().toISOString(),
  };
  const checksum = await sha256Hex(new TextEncoder().encode(stableJSON(packageWithoutChecksum)));
  const recoveryPackage = { ...packageWithoutChecksum, checksum };
  return { recoveryPackage, challenge: createChallenge(recoveryPhrase) };
}

export async function confirmRecoveryPackage({
  workspaceId,
  vaultId,
  deviceToken,
  recoveryPackage,
  challenge,
  answers,
}: {
  workspaceId: string;
  vaultId: string;
  deviceToken: string;
  recoveryPackage: RecoveryPackageV2;
  challenge: RecoveryChallenge[];
  answers: string[];
}): Promise<void> {
  if (challenge.length !== 4 || answers.length !== 4 || challenge.some((item, index) => (
    normalizeWord(answers[index]) !== item.expected
  ))) {
    throw new Error('Recovery word verification failed');
  }
  const { checksum, ...unsigned } = recoveryPackage;
  if (await sha256Hex(new TextEncoder().encode(stableJSON(unsigned))) !== checksum) {
    throw new Error('The recovery package checksum is invalid');
  }
  await setVaultRecoveryToken(vaultId, deviceToken, recoveryPackage.recoveryToken);
  const state = await loadVaultSyncState(workspaceId);
  state.recoveryConfigured = true;
  await saveVaultSyncState(workspaceId, state);
}

export function downloadRecoveryPackage(value: RecoveryPackageV2): void {
  const blob = new Blob([`${JSON.stringify(value, undefined, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `ksamint-recovery-${value.vaultId.slice(0, 8)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function decodeRecoveryPackage(value: string): Promise<{
  recoveryPackage: RecoveryPackageV2;
  masterKey: Uint8Array;
}> {
  const parsed = JSON.parse(value) as RecoveryPackageV2;
  if (
    parsed.protocolVersion !== 2
    || typeof parsed.vaultId !== 'string'
    || typeof parsed.recoveryPhrase !== 'string'
    || typeof parsed.recoveryToken !== 'string'
    || typeof parsed.checksum !== 'string'
  ) throw new Error('Unsupported recovery package');
  const { checksum, ...unsigned } = parsed;
  if (await sha256Hex(new TextEncoder().encode(stableJSON(unsigned))) !== checksum) {
    throw new Error('The recovery package checksum is invalid');
  }
  const [{ mnemonicToEntropy }, { wordlist }] = await Promise.all([
    import('@scure/bip39'),
    import('@scure/bip39/wordlists/english.js'),
  ]);
  const masterKey = mnemonicToEntropy(parsed.recoveryPhrase, wordlist);
  if (masterKey.length !== 32 || unbase64(parsed.recoveryToken).length < 32) {
    throw new Error('The recovery package does not contain a 256-bit Vault key and token');
  }
  return { recoveryPackage: parsed, masterKey };
}

function createChallenge(phrase: string): RecoveryChallenge[] {
  const words = phrase.split(' ');
  const positions = new Set<number>();
  while (positions.size < 4) {
    const random = crypto.getRandomValues(new Uint32Array(1))[0];
    positions.add((random % words.length) + 1);
  }
  return [...positions].sort((left, right) => left - right).map(position => ({
    position,
    expected: normalizeWord(words[position - 1]),
  }));
}

function normalizeWord(value: string): string {
  return value.trim().normalize('NFKC').toLocaleLowerCase('en');
}

function stableJSON(value: object): string {
  return JSON.stringify(value, Object.keys(value).sort());
}

function base64(value: Uint8Array): string {
  return btoa(String.fromCharCode(...value));
}

function unbase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), character => character.charCodeAt(0));
}

async function sha256Hex(value: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', value.slice().buffer));
  return [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
