import { useEffect, useState } from 'react';

/** Offers a reload when a newer offline build is waiting. Projects autosave locally, so reloading loses no saved work. */
export function UpdateBanner() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const show = () => setReady(true);
    if ((window as unknown as { __efoSwWaiting?: ServiceWorker }).__efoSwWaiting) show();
    window.addEventListener('efo-sw-update', show);
    return () => window.removeEventListener('efo-sw-update', show);
  }, []);
  if (!ready) return null;
  const update = () => {
    const waiting = (window as unknown as { __efoSwWaiting?: ServiceWorker }).__efoSwWaiting;
    if (!waiting) { window.location.reload(); return; }
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
    waiting.postMessage('SKIP_WAITING');
  };
  return <div className="efo-update-banner" role="status" data-sw-update>
    <span>A new version of EFO Skill Lab is ready. Your project is saved in this browser.</span>
    <button type="button" className="btn primary small" data-sw-update-apply onClick={update}>Reload to update</button>
    <button type="button" className="btn ghost small" onClick={() => setReady(false)}>Later</button>
  </div>;
}
