(()=>{
const G=window.DRV||{},API='https://www.googleapis.com/drive/v3/files',SC='https://www.googleapis.com/auth/drive.readonly',MAXB=45*1048576;
const rx=p=>new RegExp('(?<![a-z0-9])(?:'+p+')(?![a-z0-9])','i');
const ONE=rx('s\\s?1|sem(?:estre)?\\.?\\s?1|1(?:er|ère|ere)?\\s?semestre|premier\\s+semestre|semester\\s?1');
const OTH=rx('s\\s?[2-9]|sem(?:estre)?\\.?\\s?[2-9]|[2-9](?:e|è|eme|ème)?\\s?semestre|semester\\s?[2-9]');
const semOf=(path,name)=>{for(const s of [name,...[...path].reverse()]){if(ONE.test(s))return's1';if(OTH.test(s))return'other'}return'?'};
const TYP=t=>rx('annales?|examens?|concours').test(t)?'Annale':rx('partiels?|blanc').test(t)?'Partiel':rx('td|travaux\\s+dirig[ée]s?').test(t)?'TD':rx('tp|travaux\\s+pratiques?').test(t)?'TP':rx('devoirs?|compositions?|dm').test(t)?'Devoir':rx('corrections?|corrig[ée]s?').test(t)?'Correction':'Cours';
const norm=n=>n.toLowerCase().replace(/\.pdf$/,'').replace(/[^a-z0-9]+/g,'');
let REP=null;try{REP=JSON.parse(localStorage.getItem('rm_rep')||'null')}catch(e){}
const H=h=>({headers:{Authorization:'Bearer '+h}});
function token(){return new Promise((res,rej)=>{if(!window.google||!google.accounts)return rej(new Error('Service Google indisponible (hors ligne ?)'));
google.accounts.oauth2.initTokenClient({client_id:G.CLIENT,scope:SC,callback:r=>r.access_token?res(r.access_token):rej(new Error(r.error||'Connexion refusée')),error_callback:e=>rej(new Error(e.type||'Connexion annulée'))}).requestAccessToken()})}
async function ls(id,tok){const out=[];let pt='';do{const u=`${API}?q=${encodeURIComponent(`'${id}' in parents and trashed=false`)}&fields=nextPageToken,files(id,name,mimeType,modifiedTime,size,md5Checksum)&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true${pt?'&pageToken='+pt:''}`;
const r=await fetch(u,H(tok));if(!r.ok)throw new Error('Drive '+r.status+(r.status==404?' (dossier inaccessible avec ce compte)':''));const j=await r.json();out.push(...j.files);pt=j.nextPageToken}while(pt);return out}
async function walk(id,path,tok,acc,src){for(const f of await ls(id,tok)){if(f.mimeType=='application/vnd.google-apps.folder')await walk(f.id,[...path,f.name],tok,acc,src);else acc.push({...f,path,src})}}
async function get(f,tok){const r=await fetch(`${API}/${f.id}?alt=media&supportsAllDrives=true`,H(tok));if(!r.ok)throw new Error(r.status);return new Blob([await r.blob()],{type:'application/pdf'})}
async function resync(){const box=$('#drv');
if(!G.CLIENT||G.CLIENT.startsWith('COLLE')){box.innerHTML='<div class="m">Renseigne ton Client ID Google dans drive-config.js.</div>';return}
if(!navigator.onLine){box.innerHTML='<div class="m">Hors ligne : les dernières données sont conservées. Resynchronise quand Internet revient.</div>';return}
const say=t=>box.innerHTML=`<div class="m">${esc(t)}</div>`;
try{say('Connexion à Google…');const tok=await token();
const all=[],bad=new Set(),rep={d:new Date().toLocaleString('fr-FR'),neu:[],mod:[],off:[],dup:[],ver:[],chk:[],other:0,nonpdf:0,big:[],err:[],q:0};
for(const f of G.FOLDERS||[]){say(`Analyse de ${f.label}…`);try{await walk(f.id,[],tok,all,f.label)}catch(e){bad.add(f.label);rep.err.push(f.label+' : '+e.message)}}
const pdfs=all.filter(f=>f.mimeType=='application/pdf'),seen=new Set(pdfs.map(f=>f.id));rep.nonpdf=all.length-pdfs.length;
const cand=[],md5s=new Map();
for(const f of pdfs){const sem=semOf(f.path,f.name);if(sem=='other'){rep.other++;continue}
const sig=f.md5Checksum||f.modifiedTime;if(md5s.has(sig)){rep.dup.push(`${f.name} (${f.src}) = ${md5s.get(sig)}`);continue}md5s.set(sig,`${f.name} (${f.src})`);cand.push({...f,sem,sig})}
const byN=new Map();cand.forEach(f=>{const k=norm(f.name);byN.set(k,[...(byN.get(k)||[]),f])});
byN.forEach(l=>{if(l.length>1)rep.ver.push(l.map(f=>`${f.name} (${f.src})`).join(' ≠ '))});
const today=new Date().toISOString().slice(0,10);let n=0;
for(const f of cand){n++;const ex=S.docs.find(d=>d.gid==f.id&&!d.del);
if(ex&&ex.md5==f.sig){if(ex.off){ex.off=false;touch(ex)}continue}
if(Number(f.size)>MAXB){rep.big.push(f.name);continue}
say(`Téléchargement ${n}/${cand.length} : ${f.name}`);
try{const blob=await get(f,tok);
if(ex){await idb('put',ex.id,blob);ex.ver++;ex.md5=f.sig;ex.imp=today;ex.up=false;ex.off=false;touch(ex);rep.mod.push(f.name);
live('qs').filter(q=>q.doc==ex.id).forEach(q=>{q.next=0;q.rev=true;touch(q);rep.q++})}
else{const id=uid(),segs=f.path.filter(s=>!ONE.test(s)&&!OTH.test(s));await idb('put',id,blob);
S.docs.push(touch({id,nom:f.name,titre:f.name.replace(/\.pdf$/i,''),mat:segs[0]||'Sans matière',chap:segs[1]||'—',type:TYP(f.path.join(' ')+' '+f.name),desc:f.path.join(' / '),date:(f.modifiedTime||'').slice(0,10),src:f.src,gid:f.id,md5:f.sig,ver:1,imp:today,up:false,chk:f.sem=='?'}));
rep.neu.push(f.name);if(f.sem=='?')rep.chk.push(f.name)}}
catch(e){rep.err.push(f.name+' : '+e.message)}}
live('docs').filter(d=>d.gid&&!d.off&&!bad.has(d.src)&&!seen.has(d.gid)).forEach(d=>{d.off=true;touch(d);rep.off.push(d.titre)});
REP=rep;try{localStorage.setItem('rm_rep',JSON.stringify(rep))}catch(e){}save();R.docs()}
catch(e){box.innerHTML=`<div class="m" style="color:var(--ko)">Échec : ${esc(e.message)}</div>`}}
const row=(l,a)=>{const n=Array.isArray(a)?a.length:a;return n?`<div>• <b>${n}</b> ${l}${Array.isArray(a)?`<div class="m">${a.slice(0,8).map(esc).join('<br>')}${a.length>8?'<br>…':''}</div>`:''}</div>`:''};
const rapport=r=>!r?'':`<div class="c"><b>Rapport de synchronisation</b> <span class="m">${esc(r.d)}</span>
${row('nouveau(x) document(s)',r.neu)}${row('document(s) modifié(s) mis à jour',r.mod)}${r.q?row('question(s) à revoir aujourd\'hui (document modifié)',r.q):''}${row('document(s) désactivé(s) (supprimé(s) du Drive)',r.off)}${row('doublon(s) ignoré(s)',r.dup)}${row('versions différentes du même cours à comparer',r.ver)}${row('document(s) au semestre non précisé (à vérifier)',r.chk)}${row('document(s) d\'autres semestres ignoré(s)',r.other)}${row('fichier(s) non PDF ignoré(s)',r.nonpdf)}${row('fichier(s) trop gros (&gt; 45 Mo) ignoré(s)',r.big)}${row('erreur(s)',r.err)}
${!(r.neu.length+r.mod.length+r.off.length+r.dup.length+r.ver.length+r.err.length+r.big.length)?'<div class="m">Aucun changement.</div>':''}</div>`;
window.DRV_SYNC=resync;
function dl2(){const f=($('#fq')?.value||'').toLowerCase();$('#dl').innerHTML=live('docs').filter(d=>(d.titre+d.mat+d.chap).toLowerCase().includes(f)).map(d=>`<div class="c"><b>${esc(d.titre)}</b><br><span class="tag">${esc(d.type)}</span><span class="tag">${esc(d.mat)}</span><span class="tag">${esc(d.chap)}</span><span class="tag">v${d.ver}</span><span class="tag">${esc(d.src||'')}</span>${d.chk?'<span class="tag">S1 à vérifier</span>':''}${d.off?'<span class="tag">désactivé</span>':''}<div class="m">${esc(d.desc)} · ${d.imp}</div><button class="b g" onclick="view('${d.id}')">Lire</button><button class="b g" onclick="delDoc('${d.id}')">Supprimer</button></div>`).join('')||'<p class="m">Aucun document.</p>'}
window.dl=dl2;
const _docs=R.docs;
R.docs=function(){_docs();const h=document.createElement('div');h.innerHTML=`<div class="c"><b>Google Drive</b><br><span class="m">Importe les PDF du semestre 1 depuis tes deux Drives.</span><br><button class="b" onclick="DRV_SYNC()">Resynchroniser les Drives</button><div id="drv"></div></div>${rapport(REP)}`;$('#v').insertBefore(h,$('#v').children[1]);dl2()};
})();
