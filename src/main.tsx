import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './ui/theme.css';
import './ui/app.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener(
    'load',
    () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          // A new build waits instead of replacing the running one; tell the app so it can offer a safe reload.
          const announce = () => {
            if (registration.waiting && navigator.serviceWorker.controller) {
              (window as unknown as { __efoSwWaiting?: ServiceWorker }).__efoSwWaiting = registration.waiting;
              window.dispatchEvent(new CustomEvent('efo-sw-update'));
            }
          };
          announce();
          registration.addEventListener('updatefound', () => {
            const worker = registration.installing;
            worker?.addEventListener('statechange', () => { if (worker.state === 'installed') announce(); });
          });
          // Look for a newer build occasionally while the tab stays open.
          window.setInterval(() => { void registration.update().catch(() => undefined); }, 30 * 60 * 1000);
        })
        .catch((error) => console.warn('Offline caching unavailable; online lab continues.', error));
    },
    { once: true },
  );
}
