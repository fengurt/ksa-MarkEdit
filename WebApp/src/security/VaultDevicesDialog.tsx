import { useEffect, useState } from 'react';
import {
  listVaultDevices,
  rejectDeviceEnrollment,
  renameVaultDevice,
  revokeVaultDevice,
  type PendingDeviceEnrollment,
  type VaultDevice,
} from '../api/client';
import { approvePendingEnrollment, recoverVaultFromPackage } from './VaultEnrollment';
import { loadVaultSyncState } from './VaultKeyStore';

export function VaultDevicesDialog({ workspaceId, onClose }: {
  workspaceId: string;
  onClose: () => void;
}) {
  const [vaultId, setVaultId] = useState<string>();
  const [devices, setDevices] = useState<VaultDevice[]>([]);
  const [pending, setPending] = useState<PendingDeviceEnrollment[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string>();

  async function refresh() {
    const { resolvedVaultId, catalog } = await loadDeviceCatalog(workspaceId);
    setVaultId(resolvedVaultId);
    setDevices(catalog.devices);
    setPending(catalog.pending);
  }

  useEffect(() => {
    let active = true;
    void loadDeviceCatalog(workspaceId).then(({ resolvedVaultId, catalog }) => {
      if (!active) return;
      setVaultId(resolvedVaultId);
      setDevices(catalog.devices);
      setPending(catalog.pending);
    }).catch(caught => {
      if (active) setError(caught instanceof Error ? caught.message : String(caught));
    });
    return () => { active = false; };
  }, [workspaceId]);

  async function act(id: string, operation: () => Promise<void>) {
    setBusy(id);
    setError(undefined);
    try {
      await operation();
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="manager-dialog device-dialog" role="dialog" aria-modal="true" aria-labelledby="devices-title">
        <header>
          <div><p className="eyebrow">End-to-end encryption</p><h2 id="devices-title">Vault devices</h2></div>
          <button type="button" onClick={onClose} aria-label="Close">×</button>
        </header>
        <label className="recovery-package-import">
          Recover with a 24-word package
          <input type="file" accept="application/json,.json" disabled={Boolean(busy)} onChange={event => {
            const file = event.target.files?.[0];
            if (!file) return;
            void act('recovery', async () => recoverVaultFromPackage({
              workspaceId,
              packageJSON: await file.text(),
            }));
            event.currentTarget.value = '';
          }} />
        </label>
        {pending.length > 0 && <section>
          <h3>Waiting for approval</h3>
          <ul className="device-list pending-device-list">
            {pending.map(request => <li key={request.requestId}>
              <div>
                <strong>{request.displayName}</strong>
                <span>Verify on both devices: <b>{request.verificationCode}</b></span>
                <small>Expires {new Date(request.expiresAt).toLocaleTimeString()}</small>
              </div>
              <div className="device-actions">
                <button type="button" disabled={Boolean(busy)} onClick={() => vaultId && void act(request.requestId, () => approvePendingEnrollment({ workspaceId, vaultId, enrollment: request }))}>Approve</button>
                <button type="button" disabled={Boolean(busy)} onClick={() => vaultId && void act(request.requestId, () => rejectDeviceEnrollment(vaultId, request.requestId))}>Reject</button>
              </div>
            </li>)}
          </ul>
        </section>}
        <section>
          <h3>Authorized devices</h3>
          <ul className="device-list">
            {devices.map(device => <li key={device.id}>
              <div>
                <strong>{device.displayName}</strong>
                <span>{device.lastUsedAt ? `Last active ${new Date(device.lastUsedAt).toLocaleString()}` : 'Not used yet'}</span>
              </div>
              {!device.revokedAt && <div className="device-actions">
                <button type="button" disabled={Boolean(busy)} onClick={() => {
                  const name = window.prompt('Device name', device.displayName)?.trim();
                  if (vaultId && name && name !== device.displayName) void act(`rename-${device.id}`, () => renameVaultDevice(vaultId, device.id, name));
                }}>Rename</button>
                <button type="button" disabled={Boolean(busy)} onClick={() => vaultId && window.confirm(`Revoke ${device.displayName}? Revoking a lost device should be followed by Vault key rotation and a replacement recovery package.`) && void act(device.id, () => revokeVaultDevice(vaultId, device.id))}>Revoke</button>
              </div>}
            </li>)}
          </ul>
        </section>
        {error && <p className="inline-notice" role="alert">{error}</p>}
        <footer><button type="button" onClick={onClose}>Close</button></footer>
      </section>
    </div>
  );
}

async function loadDeviceCatalog(workspaceId: string) {
  const state = await loadVaultSyncState(workspaceId);
  if (!state.vaultId) throw new Error('Sync once to create a Vault before managing devices');
  return { resolvedVaultId: state.vaultId, catalog: await listVaultDevices(state.vaultId) };
}
