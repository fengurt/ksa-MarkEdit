import { useEffect, useMemo, useRef, useState } from 'react';
import type { NoteFile } from '../types';
import { SemanticSearch, type SemanticSearchHit } from './SemanticSearch';

export function DeepSearchPanel({ files, onOpen }: { files: NoteFile[]; onOpen: (id: string) => void }) {
  const engine = useRef<SemanticSearch | undefined>(undefined);
  const indexedRevision = useRef('');
  const revision = useMemo(() => files.map(file => `${file.id}:${file.modifiedAt}`).join('|'), [files]);
  const [query, setQuery] = useState('');
  const [progress, setProgress] = useState<{ completed: number; total: number }>();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hits, setHits] = useState<SemanticSearchHit[]>([]);
  const [error, setError] = useState<string>();
  const [availableStorage, setAvailableStorage] = useState<number>();
  useEffect(() => {
    void navigator.storage.estimate().then(estimate => {
      if (estimate.quota !== undefined && estimate.usage !== undefined) {
        setAvailableStorage(Math.max(0, estimate.quota - estimate.usage));
      }
    });
  }, []);
  useEffect(() => {
    if (!ready || !engine.current || indexedRevision.current === revision) return undefined;
    const timer = window.setTimeout(() => {
      indexedRevision.current = revision;
      engine.current?.index(files);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [files, ready, revision]);
  useEffect(() => () => engine.current?.close(), []);
  return <article className="hub-panel deep-search-panel">
    <p className="eyebrow">Private · on-device</p>
    <h2>Deep Search</h2>
    {!ready ? <>
      <p>Downloads about 135 MB of checksum-verified multilingual-e5-small model files to this browser. Notes and vectors never leave the encrypted workspace.</p>
      {availableStorage !== undefined && <small>{Math.round(availableStorage / 1024 / 1024)} MB browser storage currently available.</small>}
      {progress && <progress value={progress.completed} max={progress.total || 1} />}
      <button type="button" disabled={busy} onClick={() => {
        setBusy(true);
        setError(undefined);
        const value = new SemanticSearch(
          (completed, total) => setProgress({ completed, total }),
          (status, message) => {
            if (status === 'indexed') setReady(true);
            else setError(message);
            setBusy(false);
          },
        );
        engine.current = value;
        indexedRevision.current = revision;
        value.index(files);
      }}>{busy ? 'Downloading and indexing…' : 'Download model and build index'}</button>
      {busy && <button type="button" onClick={() => engine.current?.cancel()}>Cancel</button>}
    </> : <>
      <form onSubmit={event => {
        event.preventDefault();
        setBusy(true);
        void engine.current?.search(query).then(setHits).catch(caught => setError(caught.message)).finally(() => setBusy(false));
      }}>
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search meaning across languages…" />
        <button type="submit" disabled={!query.trim() || busy}>Search</button>
      </form>
      <ul>{hits.map(hit => <li key={`${hit.fileId}:${hit.offset}`}><button type="button" onClick={() => onOpen(hit.fileId)}><strong>{hit.heading || hit.path}</strong><span>{hit.text.slice(0, 180)}</span><small>{Math.round(hit.score * 100)}%</small></button></li>)}</ul>
    </>}
    {error && <p className="inline-notice" role="alert">{error}</p>}
  </article>;
}
