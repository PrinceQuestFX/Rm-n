const C='rm-v5',SH=['./','index.html','app.js','config.js','drive.js','drive-config.js','gen.js','manifest.json','icon-192.png'];
const CDN=/^(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)$/;
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(SH)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!=C).map(x=>caches.delete(x)))).then(()=>clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);
if(r.method!=='GET')return;
if(u.origin!==location.origin&&!CDN.test(u.hostname))return;
e.respondWith(fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(r,cp))}return res}).catch(()=>caches.match(r).then(m=>m||(r.mode==='navigate'?caches.match('index.html'):Response.error()))))});
