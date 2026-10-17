(()=>{
const KEY='rm_gen',EX=['Annale','Partiel','TD','TP','Devoir'];
let C={url:'http://localhost:11434',model:'qwen2.5:7b',ppc:2,k:3,models:[]};
try{Object.assign(C,JSON.parse(localStorage.getItem(KEY)||'{}'))}catch(e){}
const saveC=()=>{try{localStorage.setItem(KEY,JSON.stringify(C))}catch(e){}};
const mmss=s=>String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
const SYS="Tu es un assistant pédagogique pour des étudiants en médecine (1re année, semestre 1). Tu réponds uniquement en JSON valide, en français.";
const SCH={type:'object',properties:{questions:{type:'array',items:{type:'object',properties:{type:{type:'string',enum:['qcm','court']},q:{type:'string'},options:{type:'array',items:{type:'object',properties:{t:{type:'string'},ok:{type:'boolean'}},required:['t','ok']}},rep:{type:'string'},extrait:{type:'string'},page:{type:'integer'}},required:['type','q','rep','extrait']}}},required:['questions']};
const norm=t=>String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const W=t=>norm(t).split(' ').filter(w=>w.length>3);
const supported=(e,txt)=>{const a=W(e);if(a.length<4)return false;const s=new Set(W(txt));return a.filter(w=>s.has(w)).length/a.length>=.75};
let R2=null,tm=null;
const base=()=>C.url.replace(/\/+$/,'');
const connMsg=e=>(e instanceof TypeError)?"Impossible de joindre Ollama. Vérifie : 1) Ollama est lancé, 2) la variable OLLAMA_ORIGINS contient https://rm-three-woad.vercel.app (puis redémarre Ollama), 3) tu utilises Chrome ou Edge sur l'ordinateur et tu acceptes l'accès au réseau local.":e.message;
function readC(){const g=i=>document.getElementById(i);if(g('gu')){C.url=g('gu').value.trim()||C.url;C.model=g('gm').value||C.model;C.ppc=Math.max(1,Math.min(8,+g('gp').value||C.ppc));C.k=Math.max(1,Math.min(8,+g('gk').value||C.k))}saveC()}
function paint(){const b=$('#gen');if(!b||!R2)return;const sec=Math.floor((Date.now()-R2.t0)/1000);
b.innerHTML=`<div class="m" style="margin:8px 0 4px;${R2.err?'color:var(--ko)':''}">${esc(R2.msg)}</div><div class="bar"><i style="width:${R2.pct}%"></i></div>
<div class="m">${R2.pct}% · ${R2.added} question(s) ajoutée(s) · temps écoulé ${mmss(sec)}${R2.run&&R2.tk?` · le modèle écrit… (${R2.tk} caractères)`:''}</div>
${R2.log.slice(-6).map(l=>`<div class="m" style="${l[0]=='!'?'color:var(--ko)':''}">${esc(l)}</div>`).join('')}${R2.run?'<button class="b g" onclick="GEN_STOP()">Arrêter</button>':''}`}
const note=m=>{R2.log.push(m);paint()};
window.GEN_STOP=()=>{if(R2&&R2.run){R2.stop=true;R2.msg='Arrêt en cours…';if(R2.ctl)R2.ctl.abort();paint()}};
window.GEN_TEST=async()=>{readC();const b=$('#gen');b.innerHTML='<div class="m">Test de la connexion…</div>';
try{const j=await(await fetch(base()+'/api/tags')).json();C.models=(j.models||[]).map(m=>m.name);if(!C.models.length)throw new Error('Ollama répond, mais aucun modèle n\'est installé. Tape dans cmd : ollama pull qwen2.5:7b');
if(!C.models.includes(C.model))C.model=C.models[0];saveC();$('#gm').innerHTML=C.models.map(m=>`<option ${m==C.model?'selected':''}>${esc(m)}</option>`).join('');
b.innerHTML=`<div class="m" style="color:var(--ok)">✓ Ollama connecté · ${C.models.length} modèle(s) : ${esc(C.models.join(', '))}</div>`}
catch(e){b.innerHTML=`<div class="m" style="color:var(--ko)">${esc(connMsg(e))}</div>`}};
async function blob(id){let f=await idb('get',id);if(!f&&sb&&user&&user.id!=='local'&&navigator.onLine){const r=await sb.storage.from('pdfs').download(`${user.id}/${id}`);if(r.data){f=r.data;idb('put',id,f)}}return f}
async function pagesOf(b){if(!window.pdfjsLib)throw new Error('Lecteur PDF indisponible (connexion Internet requise la première fois).');
pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const pdf=await pdfjsLib.getDocument({data:await b.arrayBuffer()}).promise,o=[];
for(let i=1;i<=pdf.numPages;i++){const t=await(await pdf.getPage(i)).getTextContent();o.push(t.items.map(x=>x.str).join(' ').replace(/\s+/g,' ').trim())}return o}
function chunks(pg,n){const o=[];for(let i=0;i<pg.length;i+=n){const sl=pg.slice(i,i+n),txt=sl.map((t,j)=>t?`[p.${i+j+1}] ${t}`:'').filter(Boolean).join('\n').slice(0,6000);if(txt.length>=300)o.push({a:i+1,b:i+sl.length,txt})}return o}
async function ask(c,d){const ctl=new AbortController();R2.ctl=ctl;R2.tk=0;
const p=`Document : « ${d.titre} » (matière : ${d.mat}), pages ${c.a} à ${c.b}.\n\nTEXTE DU COURS :\n"""\n${c.txt}\n"""\n\nÀ partir UNIQUEMENT de ce texte, crée ${C.k} questions de révision (environ les trois quarts en QCM avec 4 propositions dont une ou plusieurs justes, le reste en questions courtes). Règles : n'invente rien qui ne soit pas dans le texte ; chaque question contient un champ "extrait" qui recopie mot pour mot une phrase du texte justifiant la réponse ; indique le numéro de page ; si le texte est insuffisant, renvoie moins de questions ou une liste vide.`;
const r=await fetch(base()+'/api/chat',{method:'POST',signal:ctl.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({model:C.model,stream:true,format:SCH,options:{temperature:.2,num_ctx:8192,num_predict:1800},messages:[{role:'system',content:SYS},{role:'user',content:p}]})});
if(!r.ok)throw new Error('Ollama '+r.status+' : '+(await r.text()).slice(0,150));
const rd=r.body.getReader(),dec=new TextDecoder();let buf='',txt='';
for(;;){const{value,done}=await rd.read();if(done)break;buf+=dec.decode(value,{stream:true});let i;
while((i=buf.indexOf('\n'))>=0){const l=buf.slice(0,i).trim();buf=buf.slice(i+1);if(!l)continue;
try{const j=JSON.parse(l);if(j.error)throw new Error(j.error);txt+=j.message&&j.message.content||'';R2.tk=txt.length}catch(e){if(!(e instanceof SyntaxError))throw e}}}
try{return JSON.parse(txt)}catch(e){const m=txt.match(/\{[\s\S]*\}/);if(m)try{return JSON.parse(m[0])}catch(x){}throw new Error('Réponse illisible du modèle')}}
function check(x,c,have){const q=String(x.q||'').trim();if(q.length<10||have.has(norm(q)))return null;if(!supported(x.extrait||'',c.txt))return null;
let opts=null;if(x.type=='qcm'){opts=(x.options||[]).map(o=>({t:String(o.t||'').trim(),ok:!!o.ok})).filter(o=>o.t);
if(opts.length<2||opts.length>6||!opts.some(o=>o.ok)||opts.every(o=>o.ok)||new Set(opts.map(o=>norm(o.t))).size<opts.length)return null}
else if(!String(x.rep||'').trim())return null;
const pg=Number.isInteger(x.page)&&x.page>=c.a&&x.page<=c.b?x.page:c.a;
return{q,type:x.type=='qcm'?'qcm':'court',opts,rep:String(x.rep||'').trim(),ex:x.extrait,page:pg}}
async function doc(d,ix,tot){const b=await blob(d.id);if(!b)throw new Error('PDF indisponible sur cet appareil');
const pg=await pagesOf(b);
if(pg.join('').length<100*Math.min(pg.length,3)){d.gen={n:0,note:'scanné',date:Date.now()};touch(d);save();note(`! ${d.titre} : PDF scanné ou illisible (OCR nécessaire), ignoré`);return}
const ch=chunks(pg,C.ppc),have=new Set(live('qs').map(q=>norm(q.q)));let n=0,fails=0;
for(const [j,c] of ch.entries()){if(R2.stop)return;
R2.msg=`Document ${ix}/${tot} : ${d.titre} — bloc ${j+1}/${ch.length} (pages ${c.a}-${c.b})`;R2.pct=Math.round(((ix-1)+j/ch.length)/tot*100);paint();
let res;try{res=await ask(c,d)}catch(e){if(e instanceof TypeError||e.name=='AbortError')throw e;fails++;note(`! bloc pages ${c.a}-${c.b} : ${e.message}`);continue}
let ok=0,rej=0;
for(const x of res.questions||[]){const v=check(x,c,have);if(!v){rej++;continue}
S.qs.push(touch({id:uid(),kind:EX.includes(d.type)?'A':'B',mat:d.mat,chap:d.chap,doc:d.id,q:v.q,type:v.type,opts:v.opts,rep:(v.rep?v.rep+' — ':'')+`Source : ${d.titre}, p. ${v.page}`,box:0,next:0,ia:true,ex:v.ex}));
have.add(norm(v.q));n++;ok++;R2.added++}
note(`✓ pages ${c.a}-${c.b} : ${ok} question(s) ajoutée(s)${rej?`, ${rej} rejetée(s) (non vérifiables dans le texte)`:''}`);save()}
if(R2.stop)return;
d.gen={n,date:Date.now(),model:C.model};touch(d);save();if(window.dl)window.dl()}
async function run(docs){if(R2&&R2.run)return;readC();const b=$('#gen');
if(!docs.length){b.innerHTML='<div class="m">Aucun document à traiter.</div>';return}
R2={run:true,stop:false,t0:Date.now(),log:[],msg:'Démarrage…',pct:0,added:0,ctl:null,tk:0,err:false};clearInterval(tm);tm=setInterval(paint,1000);paint();
try{for(const [i,d] of docs.entries()){if(R2.stop)break;try{await doc(d,i+1,docs.length)}catch(e){if(e instanceof TypeError||e.name=='AbortError')throw e;note('! '+d.titre+' : '+e.message)}}
R2.msg=R2.stop?`Arrêté : ${R2.added} question(s) ajoutée(s).`:`Terminé : ${R2.added} question(s) ajoutée(s). Elles sont dans Questions et Réviser.`;if(!R2.stop)R2.pct=100}
catch(e){if(e.name=='AbortError'){R2.msg=`Arrêté : ${R2.added} question(s) ajoutée(s).`}else{R2.msg=connMsg(e);R2.err=true}}
R2.run=false;clearInterval(tm);save();paint();if(window.dl)window.dl()}
window.GEN_ALL=()=>{readC();const m=$('#gx').value;run(live('docs').filter(d=>!d.off&&!d.gen&&(!m||d.mat==m)))};
window.GEN_DOC=id=>{const d=S.docs.find(x=>x.id==id);if(!d)return;if(d.gen&&d.gen.n&&!confirm('Des questions existent déjà pour ce document. Régénérer ? (les doublons sont ignorés)'))return;readC();run([d])};
const _dl=window.dl;
window.dl=function(){if(_dl)_dl();document.querySelectorAll('#dl .c').forEach(c=>{const m=(c.innerHTML.match(/view\('([^']+)'\)/)||[])[1];if(!m)return;const d=S.docs.find(x=>x.id==m);
c.insertAdjacentHTML('beforeend',`<button class="b g" onclick="GEN_DOC('${m}')">${d&&d.gen?(d.gen.note?'Scanné (OCR requis)':`Régénérer (${d.gen.n} q.)`):'Générer des questions'}</button>`)})};
function card(){return `<div class="c"><b>Générer des questions (IA locale · Ollama)</b><br><span class="m">À utiliser sur l'ordinateur où Ollama est installé. Les questions se synchronisent ensuite sur ton téléphone.</span>
<div class="g2"><div><div class="m">Adresse d'Ollama</div><input id="gu" value="${esc(C.url)}"></div><div><div class="m">Modèle</div><select id="gm">${(C.models.length?C.models:[C.model]).map(m=>`<option ${m==C.model?'selected':''}>${esc(m)}</option>`).join('')}</select></div></div>
<div class="g2"><div><div class="m">Pages par bloc</div><input id="gp" type="number" min="1" max="8" value="${C.ppc}"></div><div><div class="m">Questions par bloc</div><input id="gk" type="number" min="1" max="8" value="${C.k}"></div></div>
<div class="m">Matière à traiter</div><select id="gx"><option value="">Toutes les matières</option>${subs().map(m=>`<option>${esc(m)}</option>`).join('')}</select>
<button class="b g" onclick="GEN_TEST()">Tester Ollama</button><button class="b" onclick="GEN_ALL()">Générer pour les documents sans questions</button><div id="gen"></div></div>`}
const _d=R.docs;
R.docs=function(){_d();const h=document.createElement('div');h.innerHTML=card();$('#v').insertBefore(h,$('#v').children[1]);if(window.dl)window.dl();if(R2)paint()};
})();
