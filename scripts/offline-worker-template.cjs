/* PLC Skills Lab versioned offline static shell. No server persistence or hardware control.
 * Generated from the exact Vite production build by scripts/build-offline.cjs.
 */
const PRECACHE=/*__PRECACHE__*/;
const VERSION=/*__VERSION__*/;
const CACHE='plc-skills-lab-shell-'+VERSION;
const PREFIX='plc-skills-lab-shell-';
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PRECACHE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).then(response=>response.ok?response:Promise.reject(new Error('Navigation response unavailable'))).catch(()=>caches.match('/index.html')));
  return;
 }
 if(!PRECACHE.includes(url.pathname))return;
 event.respondWith(caches.match(request,{ignoreSearch:true}).then(response=>response||fetch(request)));
});
