import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { signInWithPasskey } from './api/client';
import { buildGraph } from './graph/buildGraph';
import { t } from './i18n';
import { canonicalTag } from './markdown/metadata';
import { renderMarkdown } from './markdown/preview';
import { searchNotes } from './search/search';
import { VaultStorage } from './storage/VaultStorage';
import type { NoteFile, SearchHit } from './types';

type Route = 'hub' | 'editor' | 'mindmap';
type SidebarMode = 'files' | 'search' | 'tags' | 'preview';
type TaxonomyKind = 'tag' | 'category';
type TaxonomyAction = 'rename' | 'merge' | 'delete';

const accountEnabled = import.meta.env.VITE_ACCOUNT_ENABLED === 'true';
const CoreEditor = lazy(() => import('./editor/CoreEditor').then(module => ({
  default: module.CoreEditor,
})));
const MindmapStation = lazy(() => import('./graph/MindmapStation').then(module => ({
  default: module.MindmapStation,
})));

export type MacHubSnapshot = {
  workspaceName: string;
  rootPath: string;
  recentFiles: Array<{
    path: string;
    modifiedAt: number;
    category?: string;
    tags: string[];
  }>;
  tags: Array<{ identity: string; displayName: string; fileCount: number }>;
  categories: Array<{ path: string; fileCount: number }>;
  graph: {
    nodes: Array<{ path: string; title: string; category?: string; tags: string[] }>;
    edges: Array<{ sourcePath: string; targetPath: string; kind: 0 | 1 }>;
  };
  accountEnabled: boolean;
  syncEnabled: boolean;
  backupEnabled: boolean;
};

export function MacHubApp({ snapshot }: { snapshot: MacHubSnapshot }) {
  const [mindmapVisible, setMindmapVisible] = useState(false);
  const graph = useMemo(() => ({
    nodes: snapshot.graph.nodes.map(node => ({ ...node, id: node.path })),
    edges: snapshot.graph.edges.map(edge => ({
      source: edge.sourcePath,
      target: edge.targetPath,
      kind: edge.kind === 1 ? 'wiki' as const : 'markdown' as const,
    })),
  }), [snapshot]);
  const open = (path: string) => {
    window.webkit?.messageHandlers.ksamintHub?.postMessage({ action: 'open', path });
  };

  if (mindmapVisible) {
    return (
      <main className="main-content graph-route mac-hub-route">
        <button className="back-button" type="button" onClick={() => setMindmapVisible(false)}>← {t('hub')}</button>
        <Suspense fallback={<RouteLoading />}>
          <MindmapStation graph={graph} onOpenNode={open} />
        </Suspense>
      </main>
    );
  }

  return (
    <main className="main-content hub mac-hub-route">
      <header className="hub-header">
        <div>
          <p className="eyebrow">Local-first workspace</p>
          <h1>{snapshot.workspaceName}</h1>
          <p>{snapshot.rootPath}</p>
        </div>
        <span className="account-state">{t('accountOff')}</span>
      </header>
      <section className="hub-grid">
        <article className="hub-panel recent-panel">
          <div className="panel-heading">
            <h2>{t('recentDocuments')}</h2>
            <span>{snapshot.recentFiles.length}</span>
          </div>
          <ul className="recent-list">
            {snapshot.recentFiles.map(file => (
              <li key={file.path}>
                <button type="button" onClick={() => open(file.path)}>
                  <strong>{file.path.split('/').at(-1)}</strong>
                  <span>{file.path}</span>
                </button>
              </li>
            ))}
          </ul>
        </article>
        <article className="hub-panel">
          <div className="panel-heading"><h2>{t('categories')}</h2><span>{snapshot.categories.length}</span></div>
          <ul className="taxonomy-summary">
            {snapshot.categories.slice(0, 8).map(item => (
              <li key={item.path}><span>{item.path}</span><b>{item.fileCount}</b></li>
            ))}
          </ul>
        </article>
        <article className="hub-panel">
          <div className="panel-heading"><h2>{t('allTags')}</h2><span>{snapshot.tags.length}</span></div>
          <div className="tag-cloud">
            {snapshot.tags.slice(0, 18).map(item => (
              <span key={item.identity}>{item.displayName}<b>{item.fileCount}</b></span>
            ))}
          </div>
        </article>
        <article className="hub-panel action-panel">
          <p className="eyebrow">{t('deepSearch')}</p>
          <h2>{t('modelNotDownloaded')}</h2>
          <p>multilingual-e5-small · 384 dimensions · device only</p>
          <button type="button" disabled>{t('downloadModel')}</button>
        </article>
        <article className="hub-panel action-panel">
          <p className="eyebrow">Graph</p>
          <h2>Mindmap Station</h2>
          <p>{graph.nodes.length} notes · {graph.edges.length} links</p>
          <button type="button" onClick={() => setMindmapVisible(true)}>{t('open')}</button>
        </article>
      </section>
    </main>
  );
}

export default function App() {
  const [storage, setStorage] = useState<VaultStorage>();
  const [files, setFiles] = useState<NoteFile[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [route, setRoute] = useState<Route>('hub');
  const [sidebar, setSidebar] = useState<SidebarMode>('files');
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [taxonomyUndo, setTaxonomyUndo] = useState<NoteFile[]>();
  const saveTimer = useRef<number | undefined>(undefined);
  const selected = files.find(file => file.id === selectedId);
  const graph = useMemo(() => buildGraph(files), [files]);
  const hits = useMemo(() => searchNotes(files, query), [files, query]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!event.metaKey) {
        return;
      }
      if (event.shiftKey && event.key.toLowerCase() === 'e') {
        event.preventDefault();
        setSidebar(current => current === 'files' ? current : 'files');
      } else if (event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setSidebar('search');
      } else if (event.shiftKey && event.key.toLowerCase() === 't') {
        event.preventDefault();
        setSidebar('tags');
      } else if (event.shiftKey && event.key.toLowerCase() === 'h') {
        event.preventDefault();
        setRoute('hub');
      } else if (event.altKey && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        setSidebar('preview');
      } else if (event.altKey && event.key.toLowerCase() === 'm') {
        event.preventDefault();
        setRoute('mindmap');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
  }, []);

  async function continueOffline() {
    try {
      const opened = await VaultStorage.open();
      const loaded = await Promise.all(opened.listFiles().map(file => opened.readFile(file.id)));
      setStorage(opened);
      setFiles(loaded);
      setSelectedId(loaded[0]?.id);
      setRoute(loaded.length ? 'editor' : 'hub');
      setNotice(undefined);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }

  async function openFile(id: string) {
    setSelectedId(id);
    setRoute('editor');
  }

  function changeContent(content: string) {
    if (!selected || !storage) {
      return;
    }
    setFiles(current => current.map(file => (
      file.id === selected.id
        ? { ...file, content, metadata: parseMetadataLazy(content), modifiedAt: Date.now() }
        : file
    )));
    setSaving(true);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      const saved = await storage.writeFile(selected.id, content);
      setFiles(current => current.map(file => file.id === saved.id ? saved : file));
      setSaving(false);
    }, 450);
  }

  async function createNote() {
    if (!storage) {
      return;
    }
    const name = `Note ${files.length + 1}.md`;
    try {
      const file = await storage.createFile(name, `# Note ${files.length + 1}\n\n`);
      setFiles(current => [...current, file]);
      await openFile(file.id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }

  async function addTag(tag: string) {
    if (!storage || !selected || !tag.trim()) {
      return;
    }
    const tags = [...selected.metadata.tags, tag.trim()];
    const updated = await storage.setMetadata(selected.id, {
      ...selected.metadata,
      tags,
    });
    setFiles(current => current.map(file => file.id === updated.id ? updated : file));
  }

  async function removeTag(tag: string) {
    if (!storage || !selected) {
      return;
    }
    const identity = canonicalTag(tag);
    const updated = await storage.setMetadata(selected.id, {
      ...selected.metadata,
      tags: selected.metadata.tags.filter(value => canonicalTag(value) !== identity),
    });
    setFiles(current => current.map(file => file.id === updated.id ? updated : file));
  }

  async function setCategory(fileId: string, category?: string) {
    if (!storage) {
      return;
    }
    const file = files.find(value => value.id === fileId);
    if (!file) {
      return;
    }
    const updated = await storage.setMetadata(file.id, {
      ...file.metadata,
      category: category?.trim() || undefined,
    });
    setFiles(current => current.map(value => value.id === updated.id ? updated : value));
  }

  async function applyTaxonomyAction(
    kind: TaxonomyKind,
    action: TaxonomyAction,
    source: string,
    target: string,
    signal: AbortSignal,
    onProgress: (completed: number, total: number) => void,
  ) {
    if (!storage) {
      return;
    }
    const sourceIdentity = canonicalTag(source);
    const affected = files.filter(file => (
      kind === 'tag'
        ? file.metadata.tags.some(tag => canonicalTag(tag) === sourceIdentity)
        : file.metadata.category === source || file.metadata.category?.startsWith(`${source}/`)
    ));
    setTaxonomyUndo(affected.map(file => structuredClone(file)));
    const updatedFiles: NoteFile[] = [];
    setSaving(true);
    try {
      for (const [index, file] of affected.entries()) {
        if (signal.aborted) {
          throw new DOMException(t('batchCancelled'), 'AbortError');
        }
        let metadata = structuredClone(file.metadata);
        if (kind === 'tag') {
          metadata.tags = metadata.tags.flatMap(tag => {
            if (canonicalTag(tag) !== sourceIdentity) {
              return [tag];
            }
            return action === 'delete' ? [] : [target.trim()];
          });
        } else if (metadata.category) {
          metadata.category = action === 'delete'
            ? undefined
            : `${target.trim()}${metadata.category.slice(source.length)}`;
        }
        const updated = await storage.setMetadata(file.id, metadata);
        updatedFiles.push(updated);
        onProgress(index + 1, affected.length);
      }
      const byId = new Map(updatedFiles.map(file => [file.id, file]));
      setFiles(current => current.map(file => byId.get(file.id) ?? file));
    } catch (error) {
      for (const snapshot of affected) {
        await storage.writeFile(snapshot.id, snapshot.content);
      }
      setTaxonomyUndo(undefined);
      throw error;
    } finally {
      setSaving(false);
    }
  }

  async function undoTaxonomyAction() {
    if (!storage || !taxonomyUndo) {
      return;
    }
    const restored: NoteFile[] = [];
    setSaving(true);
    try {
      for (const snapshot of taxonomyUndo) {
        restored.push(await storage.writeFile(snapshot.id, snapshot.content));
      }
      const byId = new Map(restored.map(file => [file.id, file]));
      setFiles(current => current.map(file => byId.get(file.id) ?? file));
      setTaxonomyUndo(undefined);
    } finally {
      setSaving(false);
    }
  }

  if (!storage) {
    return (
      <Welcome
        notice={notice}
        onContinue={continueOffline}
        onSignIn={async () => {
          if (!accountEnabled) {
            setNotice(t('accountFeatureOff'));
            return;
          }
          try {
            await signInWithPasskey();
            await continueOffline();
          } catch (error) {
            setNotice(error instanceof Error ? error.message : String(error));
          }
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand-button" type="button" onClick={() => setRoute('hub')}>
          <span className="brand-mark" aria-hidden="true">K</span>
          <span>ksamint Notes</span>
        </button>
        <button className="workspace-switcher" type="button" onClick={() => setRoute('hub')}>
          <span>{storage.workspace().name}</span>
          <small>{t('localEncrypted')}</small>
        </button>
        <div className="topbar-spacer" />
        <span className="save-indicator" role="status">{saving ? t('saving') : t('saveState')}</span>
        <button className="quiet-button" type="button" onClick={() => setRoute('mindmap')}>
          {t('mindmap')}
        </button>
      </header>

      <div className="workspace-layout">
        <nav className="rail" aria-label={t('workspace')}>
          <RailButton label={t('files')} symbol="F" active={sidebar === 'files'} onClick={() => {
            setSidebar('files');
            setRoute('editor');
          }} />
          <RailButton label={t('search')} symbol="S" active={sidebar === 'search'} onClick={() => {
            setSidebar('search');
            setRoute('editor');
          }} />
          <RailButton label={t('tags')} symbol="T" active={sidebar === 'tags'} onClick={() => {
            setSidebar('tags');
            setRoute('editor');
          }} />
          <RailButton label={t('preview')} symbol="P" active={sidebar === 'preview'} onClick={() => {
            setSidebar('preview');
            setRoute('editor');
          }} />
          <div className="rail-spacer" />
          <RailButton label={t('hub')} symbol="H" active={route === 'hub'} onClick={() => setRoute('hub')} />
        </nav>

        {route === 'hub' ? (
          <Hub files={files} onOpen={openFile} onMindmap={() => setRoute('mindmap')} />
        ) : route === 'mindmap' ? (
          <main className="main-content graph-route">
            <Suspense fallback={<RouteLoading />}>
              <MindmapStation graph={graph} onOpenNode={openFile} />
            </Suspense>
          </main>
        ) : (
          <>
            <aside className="sidebar">
              {sidebar === 'files' && (
                <FilesPanel
                  files={files}
                  selectedId={selectedId}
                  onOpen={openFile}
                  onCreate={createNote}
                />
              )}
              {sidebar === 'search' && (
                <SearchPanel
                  query={query}
                  hits={hits}
                  onQuery={setQuery}
                  onOpen={hit => openFile(hit.fileId)}
                />
              )}
              {sidebar === 'tags' && (
                <TagsPanel
                  files={files}
                  onManage={() => setTagManagerOpen(true)}
                  onAssignCategory={setCategory}
                  onFilter={value => {
                    setQuery(value);
                    setSidebar('search');
                  }}
                />
              )}
              {sidebar === 'preview' && selected && (
                <PreviewPanel content={selected.content} />
              )}
            </aside>
            <main className="editor-route">
              {selected ? (
                <>
                  <header className="document-header">
                    <div>
                      <strong>{selected.path.split('/').at(-1)}</strong>
                      <span>{selected.path}</span>
                    </div>
                    <TagEditor
                      file={selected}
                      onAdd={addTag}
                      onRemove={removeTag}
                      onCategory={category => setCategory(selected.id, category)}
                    />
                  </header>
                  <Suspense fallback={<RouteLoading />}>
                    <CoreEditor value={selected.content} onChange={changeContent} />
                  </Suspense>
                </>
              ) : (
                <EmptyState onCreate={createNote} />
              )}
            </main>
          </>
        )}
      </div>
      {notice && (
        <div className="notice" role="alert">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(undefined)}>×</button>
        </div>
      )}
      {taxonomyUndo && (
        <button className="undo-toast" type="button" onClick={undoTaxonomyAction}>
          {t('undo')} · {taxonomyUndo.length} {t('affectedFiles').toLocaleLowerCase()}
        </button>
      )}
      {tagManagerOpen && (
        <TagManagerDialog
          files={files}
          onClose={() => setTagManagerOpen(false)}
          onApply={applyTaxonomyAction}
        />
      )}
    </div>
  );
}

function Welcome({
  notice,
  onContinue,
  onSignIn,
}: {
  notice?: string;
  onContinue: () => void;
  onSignIn: () => void;
}) {
  return (
    <main className="welcome">
      <section className="welcome-intro">
        <span className="welcome-mark" aria-hidden="true">K</span>
        <p className="eyebrow">Private Markdown workspace</p>
        <h1>Your notes remain yours.</h1>
        <p>Write, search and connect Markdown without creating an account. Encrypted sync is optional.</p>
        <div className="welcome-actions">
          <button className="primary-button" type="button" onClick={onContinue}>{t('continueOffline')}</button>
          <button className="secondary-button" type="button" onClick={onSignIn}>{t('signIn')}</button>
        </div>
        {notice && <p className="inline-notice" role="alert">{notice}</p>}
      </section>
      <section className="welcome-status" aria-label="Workspace status">
        <StatusRow label={t('recentWorkspace')} value="Personal Workspace" />
        <StatusRow label={t('recentDocuments')} value="—" />
        <StatusRow label={t('unsynced')} value="0" />
        <StatusRow label={t('backupHealth')} value={t('disabled')} />
      </section>
    </main>
  );
}

function Hub({
  files,
  onOpen,
  onMindmap,
}: {
  files: NoteFile[];
  onOpen: (id: string) => void;
  onMindmap: () => void;
}) {
  const tags = taxonomy(files);
  const categories = categoryCounts(files);
  return (
    <main className="main-content hub">
      <header className="hub-header">
        <div>
          <p className="eyebrow">Local-first workspace</p>
          <h1>{t('hub')}</h1>
          <p>{files.length} Markdown notes, encrypted on this device.</p>
        </div>
        <span className="account-state">{t('accountOff')}</span>
      </header>
      <section className="hub-grid">
        <article className="hub-panel recent-panel">
          <div className="panel-heading">
            <h2>{t('recentDocuments')}</h2>
            <span>{files.length}</span>
          </div>
          <ul className="recent-list">
            {[...files].sort((a, b) => b.modifiedAt - a.modifiedAt).slice(0, 8).map(file => (
              <li key={file.id}>
                <button type="button" onClick={() => onOpen(file.id)}>
                  <strong>{file.path.split('/').at(-1)}</strong>
                  <span>{file.path}</span>
                </button>
              </li>
            ))}
          </ul>
        </article>
        <article className="hub-panel">
          <div className="panel-heading"><h2>{t('categories')}</h2><span>{categories.length}</span></div>
          <ul className="taxonomy-summary">
            {categories.slice(0, 8).map(item => <li key={item.name}><span>{item.name}</span><b>{item.count}</b></li>)}
          </ul>
        </article>
        <article className="hub-panel">
          <div className="panel-heading"><h2>{t('allTags')}</h2><span>{tags.length}</span></div>
          <div className="tag-cloud">
            {tags.slice(0, 18).map(item => <span key={item.identity}>{item.name}<b>{item.count}</b></span>)}
          </div>
        </article>
        <article className="hub-panel action-panel">
          <p className="eyebrow">{t('deepSearch')}</p>
          <h2>{t('modelNotDownloaded')}</h2>
          <p>multilingual-e5-small · 384 dimensions · device only</p>
          <button type="button" disabled>{t('downloadModel')}</button>
        </article>
        <article className="hub-panel action-panel">
          <p className="eyebrow">Graph</p>
          <h2>Mindmap Station</h2>
          <p>Links, backlinks, tags and categories in one local graph.</p>
          <button type="button" onClick={onMindmap}>{t('open')}</button>
        </article>
      </section>
    </main>
  );
}

function FilesPanel({
  files,
  selectedId,
  onOpen,
  onCreate,
}: {
  files: NoteFile[];
  selectedId?: string;
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  return (
    <section className="sidebar-panel">
      <header className="sidebar-header"><h2>{t('files')}</h2><button type="button" onClick={onCreate}>＋</button></header>
      <ul className="file-list">
        {files.map(file => (
          <li key={file.id}>
            <button
              className={file.id === selectedId ? 'selected' : ''}
              type="button"
              draggable
              onDragStart={event => event.dataTransfer.setData('application/x-ksamint-note', file.id)}
              onClick={() => onOpen(file.id)}
            >
              <span aria-hidden="true">▤</span>{file.path}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SearchPanel({
  query,
  hits,
  onQuery,
  onOpen,
}: {
  query: string;
  hits: SearchHit[];
  onQuery: (value: string) => void;
  onOpen: (hit: SearchHit) => void;
}) {
  return (
    <section className="sidebar-panel">
      <header className="sidebar-header"><h2>{t('search')}</h2><span>{hits.length}</span></header>
      <label className="search-box">
        <span className="sr-only">{t('searchWorkspace')}</span>
        <input autoFocus value={query} onChange={event => onQuery(event.target.value)} placeholder={t('searchWorkspace')} />
      </label>
      {query && !hits.length ? <p className="empty-copy">{t('noResults')}</p> : (
        <ul className="search-list">
          {hits.map(hit => (
            <li key={`${hit.fileId}-${hit.line}`}>
              <button type="button" onClick={() => onOpen(hit)}>
                <strong>{hit.path}:{hit.line}</strong>
                <span>{hit.snippet || ' '}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TagsPanel({
  files,
  onFilter,
  onManage,
  onAssignCategory,
}: {
  files: NoteFile[];
  onFilter: (value: string) => void;
  onManage: () => void;
  onAssignCategory: (fileId: string, category?: string) => void;
}) {
  const tags = taxonomy(files);
  const categories = categoryCounts(files);
  return (
    <section className="sidebar-panel taxonomy-panel">
      <header className="sidebar-header">
        <h2>{t('tags')}</h2>
        <button type="button" onClick={onManage}>{t('manageTags')}</button>
      </header>
      <h3>{t('allTags')}</h3>
      <ul>
        {tags.map(item => (
          <li key={item.identity}>
            <button type="button" onClick={() => onFilter(`tag:"${item.name}"`)}>
              <span>{item.name}</span><b>{item.count}</b>
            </button>
          </li>
        ))}
      </ul>
      <h3>{t('categories')}</h3>
      <ul>
        {categories.map(item => (
          <li
            key={item.name}
            onDragOver={event => {
              if (event.dataTransfer.types.includes('application/x-ksamint-note')) {
                event.preventDefault();
              }
            }}
            onDrop={event => {
              event.preventDefault();
              const fileId = event.dataTransfer.getData('application/x-ksamint-note');
              if (fileId) {
                onAssignCategory(fileId, item.name);
              }
            }}
          >
            <button type="button" onClick={() => onFilter(`category:"${item.name}"`)}>
              <span>{item.name}</span><b>{item.count}</b>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PreviewPanel({ content }: { content: string }) {
  return (
    <section className="sidebar-panel preview-panel">
      <header className="sidebar-header"><h2>{t('preview')}</h2></header>
      <article className="markdown-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
    </section>
  );
}

function TagEditor({
  file,
  onAdd,
  onRemove,
  onCategory,
}: {
  file: NoteFile;
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  onCategory: (category?: string) => void;
}) {
  const [value, setValue] = useState('');
  const [category, setCategoryValue] = useState(file.metadata.category ?? '');
  useEffect(() => setCategoryValue(file.metadata.category ?? ''), [file.id, file.metadata.category]);
  return (
    <div className="document-tags">
      {file.metadata.tags.slice(0, 4).map(tag => (
        <button
          className="tag-chip"
          key={canonicalTag(tag)}
          type="button"
          title={`${t('removeTag')}: ${tag}`}
          onClick={() => onRemove(tag)}
        >
          {tag}<span aria-hidden="true">×</span>
        </button>
      ))}
      <form onSubmit={event => {
        event.preventDefault();
        onAdd(value);
        setValue('');
      }}>
        <label className="sr-only" htmlFor="add-tag">{t('addTag')}</label>
        <input id="add-tag" value={value} onChange={event => setValue(event.target.value)} placeholder={`+ ${t('addTag')}`} />
      </form>
      <form
        className="category-form"
        onSubmit={event => {
          event.preventDefault();
          onCategory(category);
        }}
      >
        <label className="sr-only" htmlFor="set-category">{t('setCategory')}</label>
        <input
          id="set-category"
          value={category}
          onChange={event => setCategoryValue(event.target.value)}
          onBlur={() => onCategory(category)}
          placeholder={t('category')}
        />
      </form>
    </div>
  );
}

function TagManagerDialog({
  files,
  onClose,
  onApply,
}: {
  files: NoteFile[];
  onClose: () => void;
  onApply: (
    kind: TaxonomyKind,
    action: TaxonomyAction,
    source: string,
    target: string,
    signal: AbortSignal,
    onProgress: (completed: number, total: number) => void,
  ) => Promise<void>;
}) {
  const [kind, setKind] = useState<TaxonomyKind>('tag');
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [action, setAction] = useState<TaxonomyAction>('rename');
  const [progress, setProgress] = useState<[number, number]>();
  const [error, setError] = useState<string>();
  const abort = useRef<AbortController | undefined>(undefined);
  const items = kind === 'tag'
    ? taxonomy(files).map(item => ({ name: item.name, count: item.count }))
    : categoryCounts(files);
  const selected = items.find(item => item.name === source);
  const needsTarget = action !== 'delete';

  async function apply() {
    if (!source || (needsTarget && !target.trim())) {
      return;
    }
    const controller = new AbortController();
    abort.current = controller;
    setProgress([0, selected?.count ?? 0]);
    setError(undefined);
    try {
      await onApply(kind, action, source, target, controller.signal, (completed, total) => {
        setProgress([completed, total]);
      });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setProgress(undefined);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget && !progress) {
        onClose();
      }
    }}>
      <section className="taxonomy-dialog" role="dialog" aria-modal="true" aria-labelledby="taxonomy-title">
        <header>
          <div>
            <p className="eyebrow">{t('workspace')}</p>
            <h2 id="taxonomy-title">{t('manageTags')}</h2>
          </div>
          <button type="button" aria-label={t('cancel')} onClick={onClose} disabled={Boolean(progress)}>×</button>
        </header>
        <div className="dialog-segments" role="tablist">
          <button className={kind === 'tag' ? 'active' : ''} type="button" onClick={() => {
            setKind('tag');
            setSource('');
          }}>{t('tags')}</button>
          <button className={kind === 'category' ? 'active' : ''} type="button" onClick={() => {
            setKind('category');
            setSource('');
          }}>{t('categories')}</button>
        </div>
        <div className="taxonomy-dialog-body">
          <ul className="taxonomy-manager-list">
            {items.map(item => (
              <li key={item.name}>
                <button className={source === item.name ? 'selected' : ''} type="button" onClick={() => {
                  setSource(item.name);
                  setTarget('');
                }}>
                  <span>{item.name}</span><b>{item.count}</b>
                </button>
              </li>
            ))}
          </ul>
          <div className="taxonomy-operation">
            <label>
              <span>{t('affectedFiles')}</span>
              <strong>{selected?.count ?? 0}</strong>
            </label>
            <div className="operation-buttons">
              {(['rename', 'merge', 'delete'] as const).map(value => (
                <button className={action === value ? 'active' : ''} type="button" key={value} onClick={() => setAction(value)}>
                  {t(value)}
                </button>
              ))}
            </div>
            {needsTarget && (
              <label>
                <span>{t('target')}</span>
                <input value={target} onChange={event => setTarget(event.target.value)} autoComplete="off" />
              </label>
            )}
            {progress && (
              <progress value={progress[0]} max={Math.max(progress[1], 1)}>
                {progress[0]} / {progress[1]}
              </progress>
            )}
            {error && <p className="dialog-error" role="alert">{error}</p>}
          </div>
        </div>
        <footer>
          <button type="button" onClick={() => progress ? abort.current?.abort() : onClose()}>
            {t('cancel')}
          </button>
          <button className="primary-button" type="button" disabled={!source || (needsTarget && !target.trim()) || Boolean(progress)} onClick={apply}>
            {t('apply')}
          </button>
        </footer>
      </section>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="empty-editor">
      <p>No note selected</p>
      <button className="primary-button" type="button" onClick={onCreate}>{t('newNote')}</button>
    </div>
  );
}

function RouteLoading() {
  return <div className="route-loading" role="status">Loading…</div>;
}

function RailButton({
  label,
  symbol,
  active,
  onClick,
}: {
  label: string;
  symbol: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button className={active ? 'active' : ''} type="button" title={label} aria-label={label} onClick={onClick}>
      <span aria-hidden="true">{symbol}</span>
    </button>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return <div className="status-row"><span>{label}</span><strong>{value}</strong></div>;
}

function taxonomy(files: NoteFile[]) {
  const values = new Map<string, { identity: string; name: string; count: number }>();
  for (const file of files) {
    for (const tag of file.metadata.tags) {
      const identity = canonicalTag(tag);
      const item = values.get(identity) ?? { identity, name: tag, count: 0 };
      item.count += 1;
      values.set(identity, item);
    }
  }
  return [...values.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function categoryCounts(files: NoteFile[]) {
  const values = new Map<string, number>();
  for (const file of files) {
    if (file.metadata.category) {
      values.set(file.metadata.category, (values.get(file.metadata.category) ?? 0) + 1);
    }
  }
  return [...values].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
}

function parseMetadataLazy(content: string) {
  const frontMatter = content.match(/^---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)/u)?.[1] ?? '';
  const category = frontMatter.match(/^category:\s*["']?([^"'\r\n#]+)["']?/mu)?.[1]?.trim();
  const rawTags = frontMatter.match(/^tags:\s*\[([^\]]*)\]/mu)?.[1] ?? '';
  const tags = rawTags.split(',').map(tag => tag.trim().replace(/^["']|["']$/gu, '')).filter(Boolean);
  return { category, tags };
}
