import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

import { registerSW } from 'virtual:pwa-register';

const updateSW = registerSW({
  onNeedRefresh() {
    const shouldReload = window.confirm('A new version is available. Reload now?');
    if (shouldReload) updateSW(true);
  },
  onOfflineReady() {
    console.log('[PWA] Offline ready');
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
