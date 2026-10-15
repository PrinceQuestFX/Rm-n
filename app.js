const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const CFG=window.CFG||{},ok_cfg=CFG.URL&&CFG.URL.startsWith('http');
const sb=(ok_cfg&&window.supabase)?supabase.createClient(CFG.URL,CFG.KEY):null;
const K=['docs','qs','j','h'],IV=[0,1,3,7,15,30],day=()=>Math.floor(Date.now()/864e5),uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const empty=()=>({docs:[],qs:[],j:[],h:[]});
let S=(()=>{try{const s=JSON.parse(localStorage.getItem('rm')||'null');if(s)return{...empty(),...s}}catch(e){}return empty()})();
let user=null,tab='dash',sess=null,sel=new Set(),tm;
const live=k=>S[k].filter(x=>!x.del),touch=o=>(o.u=Date.now(),o),due=()=>live('qs').filter(q=>!q.next||q.next<=day());
const subs=()=>[...new Set([...live('docs').map(d=>d.mat),...live('qs').map(q=>q.mat)].filter(Boolean))];
const status=t=>{$('#st').textContent=t};
function save(){try{localStorage.setItem('rm',JSON.stringify(S))}catch(e){}clearTimeout(tm);tm=setTimeout(sync,1500)}
function merge(a,b){const r={};K.forEach(k=>{const m=new Map();[...(a[k]||[]),...(b[k]||[])].forEach(x=>{const y=m.get(x.id);if(!y||(x.u||0)>(y.u||0))m.set(x.id,x)});r[k]=[...m.values()]});return r}
/* IndexedDB : copie locale des PDF (hors ligne) */
const db=new Promise(r=>{try{const q=indexedDB.open('rm',1);q.onupgradeneeded=()=>q.result.createObjectStore('f');q.onsuccess=()=>r(q.result);q.onerror=()=>r(null)}catch(e){r(null)}});
async function idb(m,k,v){const d=await db;if(!d)return null;return new Promise(r=>{try{const s=d.transaction('f',m=='get'?'readonly':'readwrite').objectStore('f');const q=m=='get'?s.get(k):m=='put'?s.put(v,k):s.delete(k);q.onsuccess=()=>r(q.result);q.onerror=()=>r(null)}catch(e){r(null)}})}
/* Synchronisation cloud */
let syncing=false;
async function sync(){if(!sb||!user||user.id==='local'||!navigator.onLine||syncing)return status(navigator.onLine?'':'hors ligne');
syncing=true;status('synchro…');
try{const{data,error}=await sb.from('userdata').select('data').eq('user_id',user.id).maybeSingle();if(error)throw error;
if(data&&data.data)S=merge(S,{...empty(),...data.data});
for(const d of S.docs){if(d.del||d.up)continue;const f=await idb('get',d.id);if(!f)continue;
const r=await sb.storage.from('pdfs').upload(`${user.id}/${d.id}`,f,{upsert:true,contentType:'application/pdf'});if(!r.error){d.up=true;touch(d)}}
const r2=await sb.from('userdata').upsert({user_id:user.id,data:S,updated_at:new Date().toISOString()});if(r2.error)throw r2.error;
try{localStorage.setItem('rm',JSON.stringify(S))}catch(e){}status('✓ synchronisé');if(sess===null&&tab!='rev')R[tab]&&R[tab]()}
catch(e){status('erreur synchro')}finally{syncing=false}}
addEventListener('online',sync);addEventListener('offline',()=>status('hors ligne'));
/* Navigation */
const T=[['dash','Accueil'],['docs','Documents'],['qs','Questions'],['rev','Réviser'],['jr','Journal']];
function nav(){$('#n').innerHTML=T.map(t=>`<button class="${tab==t[0]?'on':''}" onclick="go('${t[0]}')">${t[1]}</button>`).join('')}
function go(t){tab=t;if(t!='rev')sess=null;nav();R[t]()}
/* Connexion */
function login(){$('#n').innerHTML='';$('#v').innerHTML=`<h1>Révision Médecine S1</h1><div class="c"><b>Connexion</b><input id="em" type="email" placeholder="Email" autocomplete="email"><input id="pw" type="password" placeholder="Mot de passe (6 caractères min.)" autocomplete="current-password"><button class="b" onclick="auth(0)">Se connecter</button><button class="b g" onclick="auth(1)">Créer un compte</button><div class="m" id="msg"></div></div>`}
async function auth(create){const email=$('#em').value.trim(),password=$('#pw').value;if(!email||password.length<6)return $('#msg').textContent='Email et mot de passe (6 min.) requis.';
const r=create?await sb.auth.signUp({email,password}):await sb.auth.signInWithPassword({email,password});
if(r.error)return $('#msg').textContent=r.error.message;
if(!r.data.session)return $('#msg').textContent='Compte créé. Confirme ton email puis connecte-toi.';
user=r.data.session.user;start()}
async function logout(){if(sb)await sb.auth.signOut();localStorage.removeItem('rm_uid');user=null;login()}
function start(){const old=localStorage.getItem('rm_uid');if(old&&old!==user.id)S=empty();localStorage.setItem('rm_uid',user.id);save();go('dash');sync()}
async function init(){nav();if(!sb){user={id:'local'};$('#st').textContent='mode local (non configuré)';return go('dash')}
let s=null;try{s=(await sb.auth.getSession()).data.session}catch(e){}
user=s?s.user:(!navigator.onLine&&localStorage.getItem('rm_uid')?{id:localStorage.getItem('rm_uid')}:null);
user?start():login()}
/* Vues */
const R={
dash(){const q=live('qs'),mast=q.filter(x=>(x.box||0)>=4).length,H=live('h'),days=[...Array(14)].map((_,i)=>day()-13+i),cnt=days.map(x=>H.filter(h=>h.d==x).length),mx=Math.max(1,...cnt);
let st=0,x=day();if(!H.some(h=>h.d==x))x--;while(H.some(h=>h.d==x)){st++;x--}
const w=H.filter(h=>h.d>day()-7),acc=w.length?Math.round(w.filter(h=>h.ok).length/w.length*100):0;
const weak=subs().map(m=>{const l=H.filter(h=>h.m==m);return{m,n:l.length,p:l.length?Math.round(l.filter(h=>h.ok).length/l.length*100):0}}).filter(a=>a.n>=3).sort((a,b)=>a.p-b.p).slice(0,3);
$('#v').innerHTML=`<h1>Révision Médecine — Semestre 1</h1>
<div class="g2"><div class="c"><div class="k">${due().length}</div><div class="m">à réviser aujourd'hui</div></div><div class="c"><div class="k">${q.length?Math.round(mast/q.length*100):0}%</div><div class="m">maîtrisées (${mast}/${q.length})</div></div>
<div class="c"><div class="k">${st}</div><div class="m">jour(s) consécutif(s)</div></div><div class="c"><div class="k">${acc}%</div><div class="m">réussite sur 7 jours</div></div></div>
<button class="b" onclick="go('rev')">Commencer la révision</button>
<h2>Activité (14 derniers jours)</h2><div class="c"><div class="ch">${cnt.map(n=>`<i style="height:${n/mx*100}%" title="${n}"></i>`).join('')}</div></div>
${weak.length?`<h2>Matières à renforcer</h2>${weak.map(a=>`<div class="c"><b>${esc(a.m)}</b> <span class="m">${a.p}% de réussite (${a.n} réponses)</span></div>`).join('')}`:''}
<h2>Progression par matière</h2>${subs().map(m=>{const l=q.filter(x=>x.mat==m),k=l.filter(x=>(x.box||0)>=4).length,p=l.length?Math.round(k/l.length*100):0;return`<div class="c"><b>${esc(m)}</b> <span class="m">${l.length} questions · ${p}% maîtrisées</span><div class="bar"><i style="width:${p}%"></i></div></div>`}).join('')||'<p class="m">Ajoute des documents et des questions.</p>'}
<div class="c"><span class="m">${user&&user.email?esc(user.email):''}</span><br><button class="b g" onclick="sync()">Synchroniser</button>${sb?'<button class="b g" onclick="logout()">Déconnexion</button>':''}</div>`},
docs(){$('#v').innerHTML=`<h1>Documents</h1><div class="c"><b>Ajouter des PDF</b><input id="dt" placeholder="Titre (si un seul fichier)"><div class="g2"><input id="dm" placeholder="Matière (ex. Anatomie)"><input id="dc" placeholder="Chapitre"></div>
<div class="g2"><select id="dy"><option>Cours</option><option>Annale</option><option>TD</option><option>TP</option><option>Devoir</option><option>Partiel</option><option>Correction</option><option>Autre</option></select><input id="dd" type="date"></div>
<input id="dp" placeholder="Partie / description"><input id="df" type="file" accept="application/pdf" multiple><button class="b" onclick="addDoc()">Importer</button></div>
<input id="fq" placeholder="Rechercher (nom, matière, chapitre)" oninput="dl()"><div id="dl"></div><div id="pv"></div>`;dl()},
qs(){$('#v').innerHTML=`<h1>Questions</h1><div class="c"><b>Nouvelle question</b><select id="qk"><option value="B">Issue du cours</option><option value="A">Issue d'un examen (annale, TD, TP…)</option></select>
<div class="g2"><input id="qm" placeholder="Matière" list="ml"><input id="qc" placeholder="Chapitre"></div><datalist id="ml">${subs().map(m=>`<option>${esc(m)}`).join('')}</datalist>
<select id="qd"><option value="">Document source (optionnel)</option>${live('docs').map(d=>`<option value="${d.id}">${esc(d.titre)}</option>`).join('')}</select>
<textarea id="qq" rows="2" placeholder="Énoncé"></textarea><select id="qt" onchange="$('#qo').style.display=this.value=='qcm'?'block':'none'"><option value="qcm">QCM</option><option value="court">Question courte</option></select>
<div id="qo">${[0,1,2,3,4].map(i=>`<div style="display:flex;gap:6px;align-items:center"><input type="checkbox" class="qk" style="width:auto"><input class="qop" placeholder="Proposition ${String.fromCharCode(65+i)}"></div>`).join('')}<div class="m">Coche les propositions justes.</div></div>
<textarea id="qa" rows="2" placeholder="Réponse / explication (obligatoire pour une question courte)"></textarea><button class="b" onclick="addQ()">Ajouter</button></div>
${live('qs').map(q=>`<div class="c"><span class="tag">${q.kind=='A'?'Examen':'Cours'}</span><span class="tag">${esc(q.mat)}</span><span class="tag">boîte ${q.box||0}</span><br>${esc(q.q)}<br><button class="b g" onclick="delQ('${q.id}')">Supprimer</button></div>`).join('')||'<p class="m">Aucune question.</p>'}`},
rev(){if(!sess)sess=due().map(q=>q.id).sort(()=>Math.random()-.5);while(sess.length&&!live('qs').some(x=>x.id==sess[0]))sess.shift();
const q=live('qs').find(x=>x.id==sess[0]);sel=new Set();
if(!q){$('#v').innerHTML='<h1>Révision</h1><div class="c">🎉 Rien à réviser pour le moment. Reviens demain ou ajoute des questions.</div>';return}
$('#v').innerHTML=`<h1>Révision <span class="m">${sess.length} restante(s)</span></h1><div class="c"><span class="tag">${esc(q.mat)}</span><span class="tag">${esc(q.chap)}</span><p><b>${esc(q.q)}</b></p>
${q.type=='qcm'?q.opts.map((o,i)=>`<button class="o" onclick="pick(${i})">${String.fromCharCode(65+i)}. ${esc(o.t)}</button>`).join('')+'<button class="b" id="vb" onclick="chk()">Valider</button>':'<button class="b" onclick="show()">Voir la réponse</button>'}<div id="fb"></div></div>`},
jr(){$('#v').innerHTML=`<h1>Journal universitaire</h1><div class="c"><input id="jd" type="date" value="${new Date().toISOString().slice(0,10)}"><textarea id="jt" rows="3" placeholder="Modification d'un prof, retard, rattrapage, remarque…"></textarea><input id="jm" placeholder="Matière (optionnel)"><button class="b" onclick="addJ()">Ajouter</button></div>
${live('j').sort((a,b)=>b.d.localeCompare(a.d)).map(e=>`<div class="c"><span class="tag">${e.d}</span>${e.m?`<span class="tag">${esc(e.m)}</span>`:''}<br>${esc(e.t)}<br><button class="b g" onclick="delJ('${e.id}')">Supprimer</button></div>`).join('')||'<p class="m">Aucune entrée.</p>'}`}};
function dl(){const f=($('#fq')?.value||'').toLowerCase();$('#dl').innerHTML=live('docs').filter(d=>(d.titre+d.mat+d.chap).toLowerCase().includes(f)).map(d=>`<div class="c"><b>${esc(d.titre)}</b><br><span class="tag">${esc(d.type)}</span><span class="tag">${esc(d.mat)}</span><span class="tag">${esc(d.chap)}</span><span class="tag">v${d.ver}</span><div class="m">${esc(d.desc)} · ${d.imp}</div><button class="b g" onclick="view('${d.id}')">Lire</button><button class="b g" onclick="delDoc('${d.id}')">Supprimer</button></div>`).join('')||'<p class="m">Aucun document.</p>'}
async function addDoc(){const files=[...$('#df').files],t=$('#dt').value.trim(),mat=$('#dm').value.trim()||'Sans matière';if(!files.length)return alert('Choisis au moins un PDF.');
for(const file of files){const ex=live('docs').find(d=>d.nom==file.name&&d.mat==mat),id=ex?ex.id:uid(),today=new Date().toISOString().slice(0,10);await idb('put',id,file);
if(ex){ex.ver++;ex.imp=today;ex.up=false;touch(ex)}else S.docs.push(touch({id,nom:file.name,titre:files.length==1&&t?t:file.name.replace(/\.pdf$/i,''),mat,chap:$('#dc').value.trim()||'—',type:$('#dy').value,desc:$('#dp').value.trim(),date:$('#dd').value,src:'Import manuel',ver:1,imp:today,up:false}))}
save();R.docs()}
async function view(id){let f=await idb('get',id);if(!f&&sb&&navigator.onLine){const r=await sb.storage.from('pdfs').download(`${user.id}/${id}`);if(r.data){f=r.data;idb('put',id,f)}}
if(!f)return alert('PDF indisponible (connecte-toi à Internet pour le télécharger).');$('#pv').innerHTML=`<iframe src="${URL.createObjectURL(f)}"></iframe>`;$('#pv').scrollIntoView()}
async function delDoc(id){if(!confirm('Supprimer ce document ? Les questions liées sont conservées.'))return;await idb('del',id);const d=S.docs.find(x=>x.id==id);if(d){d.del=true;touch(d)}
if(sb&&navigator.onLine)sb.storage.from('pdfs').remove([`${user.id}/${id}`]);save();R.docs()}
function addQ(){const q=$('#qq').value.trim(),type=$('#qt').value;if(!q)return alert('Énoncé requis.');let o=null;
if(type=='qcm'){o=[...document.querySelectorAll('.qop')].map((e,i)=>({t:e.value.trim(),ok:document.querySelectorAll('.qk')[i].checked})).filter(x=>x.t);if(o.length<2||!o.some(x=>x.ok))return alert('Au moins 2 propositions dont 1 juste.')}else if(!$('#qa').value.trim())return alert('Réponse requise.');
S.qs.push(touch({id:uid(),kind:$('#qk').value,mat:$('#qm').value.trim()||'Sans matière',chap:$('#qc').value.trim()||'—',doc:$('#qd').value,q,type,opts:o,rep:$('#qa').value.trim(),box:0,next:0}));save();R.qs()}
function delQ(id){const q=S.qs.find(x=>x.id==id);if(q){q.del=true;touch(q)}save();R.qs()}
function delJ(id){const e=S.j.find(x=>x.id==id);if(e){e.del=true;touch(e)}save();R.jr()}
function addJ(){const t=$('#jt').value.trim();if(!t)return;S.j.push(touch({id:uid(),d:$('#jd').value,t,m:$('#jm').value.trim()}));save();R.jr()}
const cur=()=>live('qs').find(x=>x.id==sess[0]);
function pick(i){if(!$('#vb'))return;sel.has(i)?sel.delete(i):sel.add(i);document.querySelectorAll('.o').forEach((b,j)=>b.style.outline=sel.has(j)?'2px solid var(--ac)':'')}
function chk(){const q=cur();let ok=true;document.querySelectorAll('.o').forEach((b,i)=>{const r=q.opts[i].ok;if(r)b.classList.add('ok');else if(sel.has(i))b.classList.add('ko');if(r!=sel.has(i))ok=false;b.style.outline='';b.disabled=true});
$('#vb').remove();$('#fb').innerHTML=`<p><b style="color:var(--${ok?'ok':'ko'})">${ok?'Correct':'Incorrect'}</b></p>${q.rep?`<div class="m">${esc(q.rep)}</div>`:''}<button class="b" onclick="grade(${ok})">Suivant</button>`}
function show(){$('#fb').innerHTML=`<div class="c"><b>Réponse :</b><br>${esc(cur().rep)}</div><button class="b" onclick="grade(true)">Je savais</button><button class="b g" onclick="grade(false)">Je ne savais pas</button>`}
function grade(ok){const id=sess.shift(),q=S.qs.find(x=>x.id==id);if(q){q.box=ok?Math.min(5,(q.box||0)+1):0;q.next=day()+IV[q.box];touch(q);S.h.push(touch({id:uid(),d:day(),ok,m:q.mat,q:id}));if(!ok)sess.push(id)}save();R.rev()}
init();
