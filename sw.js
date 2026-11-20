const cacheName = 'julplan-shell-v3';
const shell = ['./','./index.html','./style.css','./app.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(cacheName).then(cache=>cache.addAll(shell))));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([
  caches.keys().then(names=>Promise.all(names.filter(name=>name.startsWith('julplan-shell-') && name!==cacheName).map(name=>caches.delete(name)))),
  self.clients.claim()
])));
self.addEventListener('fetch',event=>{
  if (event.request.method!=='GET' || new URL(event.request.url).origin!==self.location.origin) return;
  event.respondWith(fetch(event.request).catch(async()=>{
    const cache=await caches.open(cacheName);
    return await cache.match(event.request,{ignoreSearch:true})
      || (event.request.mode==='navigate' ? await cache.match('./index.html') : Response.error());
  }));
});
