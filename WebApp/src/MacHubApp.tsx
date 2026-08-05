import { lazy, Suspense, useMemo, useState } from 'react';
import { t } from './i18n';

const MindmapStation = lazy(() => import('./graph/MindmapStation').then(module => ({
  default: module.MindmapStation,
})));

export type MacHubSnapshot = {
  version: number;
  hasWorkspace: boolean;
  workspaceName: string;
  rootPath: string;
  recentFiles: Array<{
    path: string;
    modifiedAt: number;
    category?: string;
    tags: string[];
  }>;
  recentDocuments: Array<{ path: string; title: string; lastOpenedAt: number }>;
  activities: Array<{
    id: string;
    path: string;
    title: string;
    kind: 'opened' | 'edited' | 'saved' | 'renamed';
    timestamp: number;
    count: number;
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
  accountServiceStatus: 'checking' | 'online' | 'offline';
  conversationPendingCount?: number;
};

declare global {
  interface Window {
    __KSAMINT_MAC_HUB__?: MacHubSnapshot;
    webkit?: {
      messageHandlers: {
        ksamintHub?: {
          postMessage: (message: unknown) => void;
        };
      };
    };
  }
}

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
  const send = (action: string, path?: string) => {
    window.webkit?.messageHandlers.ksamintHub?.postMessage({ action, path });
  };

  if (mindmapVisible) {
    return (
      <main className="main-content graph-route mac-hub-route">
        <button className="back-button" type="button" onClick={() => setMindmapVisible(false)}>← {t('hub')}</button>
        <Suspense fallback={<div className="route-loading" role="status">Loading…</div>}>
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
        <div className="account-actions">
          <span className="account-state">
            {snapshot.syncEnabled
              ? t('syncOn')
              : snapshot.accountEnabled
                ? t('accountOn')
                : snapshot.accountServiceStatus === 'offline'
                  ? t('loginServiceOffline')
                  : t('accountOff')}
          </span>
          <button
            type="button"
            disabled={snapshot.accountServiceStatus !== 'online'}
            onClick={() => send('signIn')}
          >
            {snapshot.accountServiceStatus === 'online' ? t('signIn') : t('continueOffline')}
          </button>
        </div>
      </header>
      <section className="hub-grid">
        <article className="hub-panel action-panel conversation-inbox-panel">
          <p className="eyebrow">Claude · ChatGPT · Clipboard</p>
          <h2>{t('conversationInbox')}</h2>
          <p>{snapshot.conversationPendingCount ?? 0} {t('needsReview').toLocaleLowerCase()}</p>
          <button type="button" onClick={() => send('openConversationInbox')}>{t('open')}</button>
        </article>
        <article className="hub-panel recent-panel">
          <div className="panel-heading">
            <h2>{t('recentDocuments')}</h2>
            <span>{snapshot.recentDocuments.length}</span>
          </div>
          <ul className="recent-list">
            {snapshot.recentDocuments.map(file => (
              <li key={file.path}>
                <button type="button" onClick={() => send('openRecent', file.path)}>
                  <strong>{file.title}</strong>
                  <span>{file.path}</span>
                </button>
              </li>
            ))}
          </ul>
        </article>
        <article className="hub-panel recent-panel">
          <div className="panel-heading">
            <h2>{t('activityHistory')}</h2>
            <button type="button" onClick={() => send('clearHistory')}>{t('clearHistory')}</button>
          </div>
          <ul className="recent-list activity-list">
            {snapshot.activities.slice(0, 30).map(item => (
              <li key={item.id}>
                <button type="button" onClick={() => send('openRecent', item.path)}>
                  <strong>{item.title}</strong>
                  <span>{t(item.kind)} · {new Date(item.timestamp).toLocaleString()}</span>
                </button>
              </li>
            ))}
          </ul>
        </article>
        {!snapshot.hasWorkspace && (
          <article className="hub-panel action-panel">
            <p className="eyebrow">{t('workspace')}</p>
            <h2>{t('recentWorkspace')}</h2>
            <p>{snapshot.rootPath}</p>
            <button type="button" onClick={() => send('chooseWorkspace')}>{t('chooseWorkspace')}</button>
          </article>
        )}
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
        <article className="hub-panel">
          <div className="panel-heading">
            <h2>{t('backupHealth')}</h2>
            <span>{snapshot.backupEnabled ? t('enabled') : t('disabled')}</span>
          </div>
          <p>{snapshot.backupEnabled ? t('backupOn') : t('disabled')}</p>
        </article>
      </section>
    </main>
  );
}
