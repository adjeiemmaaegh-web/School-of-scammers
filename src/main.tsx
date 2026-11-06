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
        .catch((error) => console.warn('Offline caching unavailable; online lab continues.', error));
    },
    { once: true },
  );
}
