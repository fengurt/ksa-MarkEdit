import { useEffect, useMemo, useState } from 'react';
import type { GitHubBackupSnapshot } from '../api/client';
import type { NoteFile } from '../types';
import { EncryptedBackupService } from './EncryptedBackupService';

export type BackupRestoreChoice = {
  historical: NoteFile;
  current?: NoteFile;
  strategy: 'current' | 'historical' | 'both' | 'combine';
};

export function BackupHistoryDialog({ workspaceId, files, onClose, onRestore }: {
  workspaceId: string;
  files: NoteFile[];
  onClose: () => void;
  onRestore: (choices: BackupRestoreChoice[]) => Promise<void>;
}) {
  const service = useMemo(() => new EncryptedBackupService(workspaceId), [workspaceId]);
  const [snapshots, setSnapshots] = useState<GitHubBackupSnapshot[]>([]);
  const [selected, setSelected] = useState<GitHubBackupSnapshot>();
  const [historical, setHistorical] = useState<NoteFile[]>([]);
  const [strategies, setStrategies] = useState<Record<string, BackupRestoreChoice['strategy']>>({});
  const [pending, setPending] = useState<string>();
  const [error, setError] = useState<string>();
  const [installationId, setInstallationId] = useState('');
  const [owner, setOwner] = useState('');
  const [repository, setRepository] = useState('ksamint-notes-backup');

  async function refresh() {
    const result = await service.history();
    setSnapshots(result.backups);
    setPending(result.pending?.lastError || (result.pending ? 'Backup queued' : undefined));
  }

  useEffect(() => {
    let active = true;
    void service.history().then(result => {
      if (!active) return;
      setSnapshots(result.backups);
      setPending(result.pending?.lastError || (result.pending ? 'Backup queued' : undefined));
    }).catch(caught => { if (active) setError(caught instanceof Error ? caught.message : String(caught)); });
    return () => { active = false; };
  }, [service]);

  return <div className="dialog-backdrop" role="presentation">
    <section className="manager-dialog backup-history-dialog" role="dialog" aria-modal="true" aria-labelledby="backup-title">
      <header><div><p className="eyebrow">Encrypted, append-only</p><h2 id="backup-title">GitHub backup history</h2></div><button type="button" onClick={onClose}>×</button></header>
      <div className="backup-toolbar">
        <button type="button" onClick={() => void service.backupNow().then(refresh).catch(caught => setError(caught.message))}>Back up now</button>
        {pending && <span>{pending}</span>}
      </div>
      <details className="github-backup-setup">
        <summary>Connect one private GitHub repository</summary>
        <p>Install the ksamint GitHub App for only the private backup repository, then enter the installation shown in the callback URL.</p>
        <div className="github-backup-fields">
          <label>Installation ID<input inputMode="numeric" value={installationId} onChange={event => setInstallationId(event.target.value.replaceAll(/\D/gu, ''))} /></label>
          <label>Owner<input value={owner} onChange={event => setOwner(event.target.value)} /></label>
          <label>Repository<input value={repository} onChange={event => setRepository(event.target.value)} /></label>
          <button type="button" disabled={!installationId || !owner.trim() || !repository.trim()} onClick={() => {
            setError(undefined);
            void service.configure({
              installationId: Number(installationId),
              owner: owner.trim(),
              repository: repository.trim(),
            }).then(refresh).catch(caught => setError(caught instanceof Error ? caught.message : String(caught)));
          }}>Connect encrypted backup</button>
        </div>
      </details>
      <div className="backup-history-layout">
        <ol>{snapshots.map(snapshot => <li key={snapshot.commit}><button type="button" className={selected?.commit === snapshot.commit ? 'selected' : ''} onClick={() => {
          setSelected(snapshot);
          setError(undefined);
          void service.open(snapshot).then(values => {
            setHistorical(values);
            setStrategies(Object.fromEntries(values.map(file => [file.id, 'current'])));
          }).catch(caught => setError(caught.message));
        }}><strong>Snapshot #{snapshot.sequence}</strong><span>{new Date(snapshot.createdAt).toLocaleString()}</span><code>{snapshot.commit.slice(0, 10)}</code></button></li>)}</ol>
        <div className="backup-file-choices">
          {historical.map(file => {
            const current = files.find(candidate => candidate.id === file.id);
            const same = current?.content === file.content && current.path === file.path;
            return <label key={file.id}><span><strong>{file.path}</strong><small>{same ? 'Unchanged' : current ? 'Different from current version' : 'Deleted on this device'}</small></span><select disabled={same} value={strategies[file.id] ?? 'current'} onChange={event => setStrategies(value => ({ ...value, [file.id]: event.target.value as BackupRestoreChoice['strategy'] }))}><option value="current">Keep current</option><option value="historical">Restore historical as new version</option><option value="both">Keep both</option>{current && <option value="combine">Combine both</option>}</select></label>;
          })}
        </div>
      </div>
      {error && <p className="inline-notice" role="alert">{error}</p>}
      <footer><button type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="button" disabled={!selected || !historical.some(file => strategies[file.id] !== 'current')} onClick={() => void onRestore(historical.map(file => ({ historical: file, current: files.find(candidate => candidate.id === file.id), strategy: strategies[file.id] ?? 'current' })).filter(choice => choice.strategy !== 'current'))}>Apply selected restore</button></footer>
    </section>
  </div>;
}
