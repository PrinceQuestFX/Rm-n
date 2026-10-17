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
function token(silent){return new Promise((res,rej)=>{if(!window.google||!google.accounts)return rej(new Error('Service Google indisponible (hors ligne ?)'));
google.accounts.oauth2.initTokenClient({client_id:G.CLIENT,scope:SC,callback:r=>r.access_token?res(r.access_token):rej(new Error(r.error||'Connexion refusée')),error_callback:e=>rej(new Error(e.type||'Connexion annulée'))}).requestAccessToken(silent?{prompt:''}:{})})}
const TOK={v:'',p:null},EXP='Session Google expirée. Relance la synchronisation : les PDF déjà importés sont conservés.';
async function gf(u){for(let k=0;k<4;k++){const r=await fetch(u,{headers:{Authorization:'Bearer '+TOK.v}});
if(r.status==401){try{await(TOK.p||(TOK.p=token(true).then(t=>{TOK.v=t}).finally(()=>{TOK.p=null})))}catch(e){throw new Error(EXP)}continue}
if([403,429,500,502,503].includes(r.status)&&k<3){await new Promise(z=>setTimeout(z,1500*(k+1)));continue}
if(!r.ok)throw new Error('Drive '+r.status+(r.status==404?' (dossier inaccessible avec ce compte)':''));return r}
throw new Error(EXP)}
async function ls(id){const out=[];let pt='';do{const u=`${API}?q=${encodeURIComponent(`'${id}' in parents and trashed=false`)}&fields=nextPageToken,files(id,name,mimeType,modifiedTime,size,md5Checksum)&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true${pt?'&pageToken='+pt:''}`;
const j=await(await gf(u)).json();out.push(...j.files);pt=j.nextPageToken}while(pt);return out}
function scan(root,acc,src,P){const q=[{id:root,path:[]}];let act=0,fail=false;
return new Promise((res,rej)=>{const pump=()=>{if(fail)return;
while(act<8&&q.length){const it=q.shift();act++;
ls(it.id).then(l=>{P.d++;P.f+=l.length;P.tick();for(const f of l){if(f.mimeType=='application/vnd.google-apps.folder'){if(OTH.test(f.name)&&!ONE.test(f.name)){P.s++;continue}q.push({id:f.id,path:[...it.path,f.name]})}else acc.push({...f,path:it.path,src})}})
.catch(e=>{if(!fail){fail=true;rej(e)}}).finally(()=>{act--;if(!fail){pump()}})}
if(!fail&&!act&&!q.length)res()};pump()})}
async function pool(items,n,fn){let i=0;await Promise.all(Array.from({length:Math.min(n,items.length)},async()=>{while(i<items.length&&!T.stop){await fn(items[i++])}}))}
async function splitPdf(blob){if(!window.PDFLib)return null;try{const src=await PDFLib.PDFDocument.load(await blob.arrayBuffer(),{ignoreEncryption:true,updateMetadata:false}),total=src.getPageCount();
let n=Math.max(2,Math.ceil(blob.size/(32*1048576)));
for(let t=0;t<4&&total>1;t++){const per=Math.ceil(total/n),out=[];let bad=false;
for(let i=0;i<total;i+=per){const d=await PDFLib.PDFDocument.create(),idx=[];for(let j=i;j<Math.min(total,i+per);j++)idx.push(j);
(await d.copyPages(src,idx)).forEach(p=>d.addPage(p));const b=new Blob([await d.save()],{type:'application/pdf'});if(b.size>MAXB)bad=true;out.push(b)}
if(!bad)return out;n=Math.min(total,n*2)}return null}catch(e){return null}}
async function get(f){const r=await gf(`${API}/${f.id}?alt=media&supportsAllDrives=true`);return new Blob([await r.blob()],{type:'application/pdf'})}
let T=null,tmr=null;
const mmss=s=>String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
function paint(){const b=$('#drv');if(!b||!T)return;const sec=Math.floor((Date.now()-T.t0)/1000),idle=Math.floor((Date.now()-T.last)/1000),stall=idle>300&&T.run;
const steps=T.steps.map((s,i)=>`<div style="color:${i<T.i?'var(--ok)':i==T.i?'var(--tx)':'var(--mu)'}">${i<T.i?'✓':i==T.i?(T.fail?'✗':'⏳'):'○'} ${esc(s)}</div>`).join('');
b.innerHTML=`<div style="margin-top:8px">${steps}</div><div class="m" style="margin:8px 0 4px">${esc(T.msg)}</div><div class="bar"><i style="width:${T.pct}%"></i></div>
<div class="m">${T.pct}% · temps écoulé ${mmss(sec)}${T.run&&idle>60&&!stall?' · toujours en cours, patiente…':''}</div>
${stall?'<div class="m" style="color:var(--ko)">Aucune progression depuis 5 minutes : recharge la page puis relance la synchronisation.</div>':''}
${T.log.slice(-6).map(l=>`<div class="m" style="${l[0]=='!'?'color:var(--ko)':''}">${esc(l)}</div>`).join('')}
${T.fail?`<div class="m" style="color:var(--ko)">${esc(T.fail)}</div><button class="b" onclick="DRV_SYNC()">Réessayer</button>`:T.run?'<button class="b g" onclick="DRV_STOP()">Annuler</button>':''}`}
window.DRV_STOP=()=>{if(T&&T.run){T.stop=true;T.msg='Annulation en cours…';paint()}};
async function resync(){const box=$('#drv');if(T&&T.run)return;
if(!G.CLIENT||G.CLIENT.startsWith('COLLE')){box.innerHTML='<div class="m">Renseigne ton Client ID Google dans drive-config.js.</div>';return}
if(!navigator.onLine){box.innerHTML='<div class="m">Hors ligne : les dernières données sont conservées. Resynchronise quand Internet revient.</div>';return}
const F=G.FOLDERS||[],N=F.length+4,iT=F.length+1,iD=F.length+2;
T={t0:Date.now(),last:Date.now(),i:0,pct:0,msg:'Ouverture de la fenêtre Google… choisis ton compte et accepte.',log:[],steps:['Connexion Google',...F.map(f=>'Analyse '+f.label),'Tri et doublons','Téléchargement des PDF'],run:true,fail:'',stop:false};
clearInterval(tmr);tmr=setInterval(paint,1000);paint();
const chk=()=>{if(T.stop)throw new Error('Synchronisation annulée')};
const set=(i,m,pc)=>{T.i=i;T.msg=m;T.pct=Math.min(100,Math.round(pc));T.last=Date.now();paint()};
const note=m=>{T.log.push(m);T.last=Date.now();paint()};
try{const tok=await token();TOK.v=tok;chk();
const all=[],bad=new Set(),rep={d:new Date().toLocaleString('fr-FR'),neu:[],mod:[],off:[],dup:[],ver:[],chk:[],other:0,skipd:0,nonpdf:0,big:[],split:[],loc:[],err:[],q:0};
for(const [k,f] of F.entries()){const P={d:0,f:0,s:0,tick(){chk();set(1+k,`Analyse de ${f.label}… ${this.d} dossier(s) lu(s), ${this.f} fichier(s) trouvé(s)`,(1+k)/N*100)}};P.tick();
try{await scan(f.id,all,f.label,P);rep.skipd+=P.s}catch(e){if(T.stop||/Session Google/.test(e.message))throw e;bad.add(f.label);rep.err.push(f.label+' : '+e.message);note('! '+f.label+' : '+e.message)}}
set(iT,'Tri des documents du semestre 1 et détection des doublons…',iT/N*100);
const pdfs=all.filter(f=>f.mimeType=='application/pdf'),seen=new Set(pdfs.map(f=>f.id));rep.nonpdf=all.length-pdfs.length;
const cand=[],md5s=new Map();
for(const f of pdfs){const sem=semOf(f.path,f.name);if(sem=='other'){rep.other++;continue}
const sig=f.md5Checksum||f.modifiedTime;if(md5s.has(sig)){rep.dup.push(`${f.name} (${f.src}) = ${md5s.get(sig)}`);continue}md5s.set(sig,`${f.name} (${f.src})`);cand.push({...f,sem,sig})}
const byN=new Map();cand.forEach(f=>{const k=norm(f.name);byN.set(k,[...(byN.get(k)||[]),f])});
byN.forEach(l=>{if(l.length>1)rep.ver.push(l.map(f=>`${f.name} (${f.src})`).join(' ≠ '))});
const today=new Date().toISOString().slice(0,10),todo=[];
for(const f of cand){const ex=S.docs.find(d=>d.gid==f.id&&!d.del);
if(ex&&ex.md5==f.sig){if(ex.off){ex.off=false;touch(ex)}continue}
f.big=Number(f.size)>MAXB;todo.push({f,ex})}
note(`${pdfs.length} PDF trouvés, ${cand.length} retenus, ${todo.length} à télécharger`);
set(iD,`Téléchargement 0/${todo.length}…`,iD/N*100);let n=0;
await pool(todo,3,async({f,ex})=>{if(T.stop)return;
try{const blob=await get(f);
if(f.big){const segs=f.path.filter(s=>!ONE.test(s)&&!OTH.test(s)),t0=f.name.replace(/\.pdf$/i,'');note(`Découpage de ${f.name} (fichier volumineux)…`);const parts=await splitPdf(blob);
S.docs.filter(d=>d.gid==f.id&&!d.del).forEach(d=>{d.del=true;touch(d);idb('del',d.id)});
const mk=(id,titre,extra)=>S.docs.push(touch({id,nom:f.name,titre,mat:segs[0]||'Sans matière',chap:segs[1]||'—',type:TYP(f.path.join(' ')+' '+f.name),desc:f.path.join(' / '),date:(f.modifiedTime||'').slice(0,10),src:f.src,gid:f.id,md5:f.sig,ver:1,imp:today,up:false,chk:f.sem=='?',...extra}));
if(parts){for(let k=0;k<parts.length;k++){const id=uid();await idb('put',id,parts[k]);mk(id,`${t0} — partie ${k+1}/${parts.length}`,{part:k+1})}rep.split.push(`${f.name} → ${parts.length} parties`)}
else{const id=uid();await idb('put',id,blob);mk(id,t0,{loc:true,up:true});rep.loc.push(f.name)}
rep.neu.push(f.name);if(f.sem=='?')rep.chk.push(f.name)}
else if(ex){await idb('put',ex.id,blob);ex.ver++;ex.md5=f.sig;ex.imp=today;ex.up=false;ex.off=false;touch(ex);rep.mod.push(f.name);
live('qs').filter(q=>q.doc==ex.id).forEach(q=>{q.next=0;q.rev=true;touch(q);rep.q++})}
else{const id=uid(),segs=f.path.filter(s=>!ONE.test(s)&&!OTH.test(s));await idb('put',id,blob);
S.docs.push(touch({id,nom:f.name,titre:f.name.replace(/\.pdf$/i,''),mat:segs[0]||'Sans matière',chap:segs[1]||'—',type:TYP(f.path.join(' ')+' '+f.name),desc:f.path.join(' / '),date:(f.modifiedTime||'').slice(0,10),src:f.src,gid:f.id,md5:f.sig,ver:1,imp:today,up:false,chk:f.sem=='?'}));
rep.neu.push(f.name);if(f.sem=='?')rep.chk.push(f.name)}
n++;set(iD,`Téléchargement ${n}/${todo.length} : ${f.name}`,(iD+n/Math.max(1,todo.length))/N*100);note('✓ '+f.name);if(n%10==0)save()}
catch(e){if(/Session Google/.test(e.message)){T.expired=e.message;T.stop=true;return}n++;rep.err.push(f.name+' : '+e.message);note('! '+f.name+' : '+e.message)}});
if(T.expired)throw new Error(T.expired);chk();
live('docs').filter(d=>d.gid&&!d.off&&!bad.has(d.src)&&!seen.has(d.gid)).forEach(d=>{d.off=true;touch(d);rep.off.push(d.titre)});
rep.sec=Math.round((Date.now()-T.t0)/1000);T.run=false;T.i=T.steps.length;T.pct=100;T.msg='Terminé';clearInterval(tmr);
REP=rep;try{localStorage.setItem('rm_rep',JSON.stringify(rep))}catch(e){}save();R.docs()}
catch(e){T.run=false;T.fail=(/annulée|Session Google/.test(e.message)?'':'Échec : ')+e.message;clearInterval(tmr);try{save()}catch(x){}paint()}}
const row=(l,a)=>{const n=Array.isArray(a)?a.length:a;return n?`<div>• <b>${n}</b> ${l}${Array.isArray(a)?`<div class="m">${a.slice(0,8).map(esc).join('<br>')}${a.length>8?'<br>…':''}</div>`:''}</div>`:''};
const rapport=r=>!r?'':`<div class="c"><b>Rapport de synchronisation</b> <span class="m">${esc(r.d)}${r.sec!=null?' · durée '+mmss(r.sec):''}</span>
${row('nouveau(x) document(s)',r.neu)}${row('document(s) modifié(s) mis à jour',r.mod)}${r.q?row('question(s) à revoir aujourd\'hui (document modifié)',r.q):''}${row('document(s) désactivé(s) (supprimé(s) du Drive)',r.off)}${row('doublon(s) ignoré(s)',r.dup)}${row('versions différentes du même cours à comparer',r.ver)}${row('document(s) au semestre non précisé (à vérifier)',r.chk)}${row('document(s) d\'autres semestres ignoré(s)',r.other)}${row('dossier(s) d\'autres semestres ignoré(s) sans être ouverts',r.skipd)}${row('fichier(s) non PDF ignoré(s)',r.nonpdf)}${row('fichier(s) volumineux découpé(s) automatiquement',r.split||[])}${row('fichier(s) volumineux gardé(s) sur ce PC seulement (non synchronisés)',r.loc||[])}${row('fichier(s) trop gros (&gt; 45 Mo) ignoré(s)',r.big)}${row('erreur(s)',r.err)}
${!(r.neu.length+r.mod.length+r.off.length+r.dup.length+r.ver.length+r.err.length+r.big.length)?'<div class="m">Aucun changement.</div>':''}</div>`;
window.DRV_SYNC=resync;
function dl2(){const f=($('#fq')?.value||'').toLowerCase();$('#dl').innerHTML=live('docs').filter(d=>(d.titre+d.mat+d.chap).toLowerCase().includes(f)).map(d=>`<div class="c"><b>${esc(d.titre)}</b><br><span class="tag">${esc(d.type)}</span><span class="tag">${esc(d.mat)}</span><span class="tag">${esc(d.chap)}</span><span class="tag">v${d.ver}</span><span class="tag">${esc(d.src||'')}</span>${d.chk?'<span class="tag">S1 à vérifier</span>':''}${d.off?'<span class="tag">désactivé</span>':''}${d.loc?'<span class="tag">PC seulement</span>':''}<div class="m">${esc(d.desc)} · ${d.imp}</div><button class="b g" onclick="view('${d.id}')">Lire</button><button class="b g" onclick="delDoc('${d.id}')">Supprimer</button></div>`).join('')||'<p class="m">Aucun document.</p>'}
window.dl=dl2;
const _docs=R.docs;
R.docs=function(){_docs();const h=document.createElement('div');h.innerHTML=`<div class="c"><b>Google Drive</b><br><span class="m">Importe les PDF du semestre 1 depuis tes deux Drives.</span><br><button class="b" onclick="DRV_SYNC()">Resynchroniser les Drives</button><div id="drv"></div></div>${rapport(REP)}`;$('#v').insertBefore(h,$('#v').children[1]);dl2();if(T&&(T.run||T.fail))paint()};
})();
