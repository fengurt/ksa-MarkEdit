import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MacHubApp } from './MacHubApp';
import './styles.css';

const snapshot = window.__KSAMINT_MAC_HUB__;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {snapshot
      ? <MacHubApp snapshot={snapshot} />
      : <div className="route-loading" role="alert">Workspace data is unavailable.</div>}
  </StrictMode>,
);
