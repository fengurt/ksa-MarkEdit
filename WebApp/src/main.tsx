import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App, { MacHubApp, type MacHubSnapshot } from './App';
import './styles.css';

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {window.__KSAMINT_MAC_HUB__
      ? <MacHubApp snapshot={window.__KSAMINT_MAC_HUB__} />
      : <App />}
  </StrictMode>,
);
