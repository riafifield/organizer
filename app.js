(function(){
const COLORS={violet:'#7f77dd',blue:'#378add',teal:'#1d9e75',green:'#6a9a2a',amber:'#d2912a',coral:'#d85a30',pink:'#d4537e',slate:'#7a8580'};
const ICONS={
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  grid:'<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
  inbox:'<path d="M4 13l2.5-8h11L20 13v6H4zM4 13h5l1 2.5h4l1-2.5h5"/>',
  done:'<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16 9.5"/>',
  spark:'<path d="M12 3v6M12 15v6M3 12h6M15 12h6M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3"/>',
  back:'<path d="M15 5l-7 7 7 7"/>',
  star:'<path d="M12 4l2.5 5.2 5.7.8-4.1 4 1 5.6L12 17l-5.1 2.6 1-5.6-4.1-4 5.7-.8z"/>'
};
const ic=(n,s)=>'<svg viewBox="0 0 24 24" width="'+(s||18)+'" height="'+(s||18)+'" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+ICONS[n]+'</svg>';

const S={projects:[],milestones:[],tasks:[],routines:[],events:[],auth:'checking',authMsg:'',loadedAt:0,status:'loading',view:'today',pid:null,
  pf:'all',hz:'now',urg:false,open:null,confirmDel:null,copy:null,capP:'',editRoutines:false,addProject:false,editProject:false,newColor:'teal',msg:''};

const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const dstr=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const today=()=>dstr(new Date());
const parseD=s=>{const a=String(s).split('-').map(Number);return new Date(a[0],a[1]-1,a[2])};
const addDays=(s,n)=>{const d=parseD(s);d.setDate(d.getDate()+n);return dstr(d)};
const dayDiff=(a,b)=>Math.round((parseD(a)-parseD(b))/864e5);
const now=()=>new Date().toISOString();
const short=d=>d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
function fmtDue(s){const n=dayDiff(s,today());return n<0?'Overdue · '+short(parseD(s)):n===0?'Due today':n===1?'Due tomorrow':'Due '+short(parseD(s))}
function fmtDay(iso){if(!iso)return '';const d=dstr(new Date(iso)),n=dayDiff(today(),d);return n===0?'Today':n===1?'Yesterday':short(parseD(d))}
function weekDates(){const t=today(),dow=(parseD(t).getDay()+6)%7,m=addDays(t,-dow);return [0,1,2,3,4,5,6].map(i=>addDays(m,i))}

const ord=(a,b)=>((a.sort==null?0:a.sort)-(b.sort==null?0:b.sort))||String(a.name||'').localeCompare(String(b.name||''));
const hzRank={now:0,next:1,later:2};
const cmp=(a,b)=>((hzRank[a.horizon]||0)-(hzRank[b.horizon]||0))||((b.urgent?1:0)-(a.urgent?1:0))||String(a.due||'9999').localeCompare(String(b.due||'9999'))||String(a.createdAt||'').localeCompare(String(b.createdAt||''));
const proj=id=>S.projects.find(p=>p.id===id)||null;
const task=id=>S.tasks.find(t=>t.id===id)||null;
const col=p=>COLORS[p&&p.color]||COLORS.slate;
const active=()=>S.projects.filter(p=>!p.archived).sort(ord);
const isOpen=t=>t.status!=='done';
const inFocus=t=>isOpen(t)&&t.focusDate&&t.focusDate<=today();
function areas(){const out=[];active().forEach(p=>{const a=p.area||'Other';let g=out.find(x=>x.name===a);if(!g){g={name:a,items:[]};out.push(g)}g.items.push(p)});return out}
function nextOf(p){const open=S.tasks.filter(t=>t.projectId===p.id&&isOpen(t));const pin=open.find(t=>t.id===p.nextTaskId);if(pin)return pin;return open.filter(t=>t.status!=='waiting').sort(cmp)[0]||null}
function quietDays(p){const ts=S.tasks.filter(t=>t.projectId===p.id);if(!ts.some(isOpen))return 0;const last=Math.max.apply(null,ts.map(t=>Date.parse(t.updatedAt||t.createdAt||0)||0));return last?Math.floor((Date.now()-last)/864e5):0}

/* ---------- saving ---------- */
const CFG=window.NEXT_STEPS_CONFIG||{};
const sb=window.supabase.createClient(CFG.url,CFG.key);
const TABLES=['projects','milestones','tasks','routines','events'];
const toRow=o=>{const r={};Object.keys(o).forEach(k=>{r[k.replace(/[A-Z]/g,c=>'_'+c.toLowerCase())]=o[k]});return r};
const fromRow=o=>{const r={};Object.keys(o).forEach(k=>{r[k.replace(/_([a-z])/g,(m,c)=>c.toUpperCase())]=o[k]});return r};
const uuid=()=>(window.crypto&&crypto.randomUUID)?crypto.randomUUID():'t'+Date.now().toString(36)+Math.random().toString(36).slice(2,10);
const lsGet=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
const lsDel=k=>{try{localStorage.removeItem(k)}catch(e){}};
let cacheT=0;
function saveCache(){clearTimeout(cacheT);cacheT=setTimeout(()=>{const o={};TABLES.forEach(t=>{o[t]=S[t]});lsSet('ns-cache',JSON.stringify(o))},400)}
function loadCache(){try{const o=JSON.parse(lsGet('ns-cache')||'null');if(o)TABLES.forEach(t=>{if(Array.isArray(o[t]))S[t]=o[t]})}catch(e){}}
function clearCache(){clearTimeout(cacheT);lsDel('ns-cache');lsDel('ns-owner')}
const queue={};
function write(table,id,data,mode){
  if(S.auth!=='in')return null;
  let run;
  if(mode==='update'){const i=S[table].findIndex(x=>x.id===id);if(i>=0)S[table][i]=Object.assign({},S[table][i],data);run=()=>sb.from(table).update(toRow(data)).eq('id',id)}
  else if(mode==='delete'){S[table]=S[table].filter(x=>x.id!==id);run=()=>sb.from(table).delete().eq('id',id)}
  else{id=id||uuid();const row=Object.assign({id:id},data);S[table].push(row);run=()=>sb.from(table).insert(toRow(row))}
  const key=table+'/'+id,fail=()=>{flash("That change didn't save. Check your connection.");loadAll()};
  queue[key]=(queue[key]||Promise.resolve()).then(()=>run()).then(r=>{if(r&&r.error)fail()},fail);
  saveCache();
  return id;
}
const upd=(c,id,patch)=>write(c,id,Object.assign({updatedAt:now()},patch),'update');
function newTask(title,pid,ms,hz){title=String(title||'').trim();if(!title)return;
  write('tasks',null,{title:title,projectId:pid||null,milestoneId:ms||null,horizon:hz||'now',urgent:false,due:null,status:'open',owner:'me',focusDate:null,notes:'',createdAt:now(),updatedAt:now(),doneAt:null,doneBy:null})}
let flashT=0;
function flash(m){S.msg=m;clearTimeout(flashT);flashT=setTimeout(()=>{S.msg='';render()},4500);render()}
function slug(name){let b=String(name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'project',s=b,i=2;while(S.projects.some(p=>p.id===s)||S.milestones.some(m=>m.id===s))s=b+'-'+(i++);return s}

/* ---------- pieces ---------- */
function taskRow(t,o){o=o||{};const done=!isOpen(t),p=proj(t.projectId),t0=today(),meta=[];
  if(o.proj&&p)meta.push('<a class="plink" href="#p-'+esc(p.id)+'"><span class="pdot" style="background:'+col(p)+'"></span>'+esc(p.name)+'</a>');
  if(t.source){const sl='From '+(t.source==='gmail'?'Gmail':'Calendar');meta.push(/^https:\/\//.test(t.sourceUrl||'')?'<a class="plink" href="'+esc(t.sourceUrl)+'" target="_blank" rel="noopener">'+sl+'</a>':'<span>'+sl+'</span>')}
  if(!done){
    if(t.urgent)meta.push('<span class="tag urgent">Urgent</span>');
    if(t.due)meta.push('<span class="'+(t.due<t0?'over':'')+'">'+esc(fmtDue(t.due))+'</span>');
    if(t.status==='waiting')meta.push('<span class="tag wait">Waiting</span>');
    if(t.owner==='claude')meta.push('<span class="tag claude">For Claude</span>');
    if(o.hz&&t.horizon&&t.horizon!=='now')meta.push('<span>'+(t.horizon==='next'?'Next':'Later')+'</span>');
    if(t.notes&&S.open!==t.id)meta.push('<span>Has notes</span>');
  }else meta.push('<span>'+(t.doneBy==='claude'?'Checked off by Claude':'Done')+' · '+esc(fmtDay(t.doneAt))+'</span>');
  const id=esc(t.id),foc=inFocus(t);
  return '<li class="task'+(done?' done':'')+'">'+
    '<button class="cb" data-act="toggle" data-id="'+id+'" aria-pressed="'+done+'" aria-label="'+(done?'Reopen':'Mark done')+': '+esc(t.title)+'">'+ic('check',14)+'</button>'+
    '<div class="tbody"><button class="ttitle" data-act="open" data-id="'+id+'" aria-expanded="'+(S.open===t.id)+'">'+esc(t.title)+'</button>'+
    '<div class="tmeta">'+meta.join('')+'</div>'+(S.open===t.id?editorHTML(t):'')+'</div>'+
    (done?'':'<button class="star" data-act="focus" data-id="'+id+'" aria-pressed="'+!!foc+'" aria-label="'+(foc?'Remove from today':'Focus on this today')+'">'+ic('star')+'</button>')+
  '</li>';
}
const chip=(act,id,on,label)=>'<button class="chip" data-act="'+act+'" data-id="'+esc(id)+'" aria-pressed="'+!!on+'">'+label+'</button>';
function projectOptions(sel){return '<option value="">Inbox</option>'+active().map(p=>'<option value="'+esc(p.id)+'"'+(p.id===sel?' selected':'')+'>'+esc(p.name)+'</option>').join('')}
function editorHTML(t){const id=esc(t.id),p=proj(t.projectId),ms=S.milestones.filter(m=>m.projectId===t.projectId).sort(ord);
  return '<div class="editor">'+
   '<input type="text" id="et-'+id+'" data-ch="t-title" data-id="'+id+'" value="'+esc(t.title)+'" aria-label="Task name">'+
   '<textarea id="en-'+id+'" data-ch="t-notes" data-id="'+id+'" rows="2" placeholder="Notes, links, or context for Claude" aria-label="Notes">'+esc(t.notes)+'</textarea>'+
   '<div class="chips">'+chip('urgent',t.id,t.urgent,'Urgent')+chip('waiting',t.id,t.status==='waiting','Waiting on someone')+
     chip('claude',t.id,t.owner==='claude',ic('spark',14)+'For Claude')+(p?chip('pin',t.id,p.nextTaskId===t.id,'Next step'):'')+'</div>'+
   '<div class="fields">'+
     '<label>Project<select id="ep-'+id+'" data-ch="t-project" data-id="'+id+'">'+projectOptions(t.projectId)+'</select></label>'+
     (ms.length?'<label>Milestone<select id="em-'+id+'" data-ch="t-ms" data-id="'+id+'"><option value="">None</option>'+ms.map(m=>'<option value="'+esc(m.id)+'"'+(m.id===t.milestoneId?' selected':'')+'>'+esc(m.name)+'</option>').join('')+'</select></label>':'')+
     '<label>When<select id="eh-'+id+'" data-ch="t-hz" data-id="'+id+'">'+[['now','Now'],['next','Next'],['later','Later']].map(h=>'<option value="'+h[0]+'"'+(h[0]===(t.horizon||'now')?' selected':'')+'>'+h[1]+'</option>').join('')+'</select></label>'+
     '<label>Due date<input type="date" id="ed-'+id+'" data-ch="t-due" data-id="'+id+'" value="'+esc(t.due||'')+'"></label>'+
   '</div>'+
   (S.copy&&S.copy.id===t.id?'<textarea class="copybox" id="ec-'+id+'" rows="3" readonly aria-label="Text to copy">'+esc(S.copy.text)+'</textarea>':'')+
   '<div class="erow"><button class="btn" data-act="copy" data-id="'+id+'">Copy for Claude</button>'+
   (S.confirmDel===t.id?'<button class="btn danger" data-act="delyes" data-id="'+id+'">Confirm delete</button>':'<button class="btn danger" data-act="del" data-id="'+id+'">Delete</button>')+'</div>'+
  '</div>';
}
function captureHTML(withSelect){return '<form class="capture" data-form="capture"><input type="text" id="cap" name="q" placeholder="Call the studio about Friday" aria-label="Add a task" autocomplete="off">'+
  (withSelect?'<select id="cap-p" data-ch="cap-p" aria-label="Where it goes">'+projectOptions(S.capP)+'</select>':'')+'<button class="btn primary" type="submit">Add</button></form>'}
function addHTML(pid,ms){const k='add-'+esc(pid)+'-'+esc(ms||'x');return '<form class="add" data-form="addtask" data-pid="'+esc(pid)+'" data-ms="'+esc(ms||'')+'"><span class="plus">'+ic('plus')+'</span><input type="text" id="'+k+'" name="q" placeholder="Add a task" aria-label="Add a task" autocomplete="off"></form>'}
const list=(ts,o)=>'<ul class="tasks">'+ts.map(t=>taskRow(t,o)).join('')+'</ul>';
function statusBar(){
  if(S.msg)return '<p class="note-bar bad" role="status">'+esc(S.msg)+'</p>';
  if(S.status==='loading')return '<p class="note-bar" role="status">Loading your tasks…</p>';
  if(S.status==='error')return '<p class="note-bar bad" role="status">Your tasks couldn\'t be loaded. Check your connection.</p>';
  if(S.status==='stale')return '<p class="note-bar" role="status">You\'re offline. Showing the last saved copy.</p>';
  return '';
}

/* ---------- views ---------- */
function todayHTML(){const t0=today();
  const focus=S.tasks.filter(inFocus).sort(cmp);
  const focusDone=S.tasks.filter(t=>!isOpen(t)&&t.focusDate&&t.doneAt&&dstr(new Date(t.doneAt))===t0);
  const due=S.tasks.filter(t=>isOpen(t)&&t.due&&t.due<=addDays(t0,1)&&!inFocus(t)).sort(cmp);
  const ps=active(),nexts=[],none=[];
  ps.forEach(p=>{const n=nextOf(p);if(!n)none.push(p);else if(!inFocus(n))nexts.push(n)});
  const byClaude=S.tasks.filter(t=>t.doneBy==='claude'&&t.doneAt&&Date.now()-Date.parse(t.doneAt)<48*36e5).sort((a,b)=>String(b.doneAt).localeCompare(String(a.doneAt)));
  let h='<h1>Today</h1><p class="sub">'+esc(new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}))+'</p>'+captureHTML(true)+eventsHTML();
  h+='<div class="label"><span>Focus</span><span class="r">'+focus.length+' of 3</span></div>';
  h+=(focus.length||focusDone.length)?list(focus.concat(focusDone),{proj:true}):'<p class="empty">Pick up to three things for today. Tap the star on any task.</p>';
  if(due.length)h+='<div class="label"><span>Due</span></div>'+list(due,{proj:true});
  if(nexts.length||none.length){h+='<div class="label"><span>Next step in each project</span></div>'+list(nexts,{proj:true});
    if(none.length)h+='<p class="empty" style="margin-top:10px">No next step yet: '+none.map(p=>'<a class="plink" href="#p-'+esc(p.id)+'"><span class="pdot" style="background:'+col(p)+'"></span>'+esc(p.name)+'</a>').join(', ')+'</p>'}
  else if(S.status==='ready'&&!ps.length)h+='<div class="label"><span>Projects</span></div><p class="empty">No projects yet. <a class="link" href="#projects">Add your first project</a></p>';
  h+=routinesHTML();
  if(byClaude.length)h+='<div class="label"><span>Finished by Claude</span></div>'+list(byClaude,{proj:true});
  return h;
}
function eventsHTML(){const t0=today(),t1=addDays(t0,1),day=e=>dstr(new Date(e.startsAt));
  const ev=S.events.filter(e=>e.startsAt&&(day(e)===t0||day(e)===t1)).sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt));
  if(!ev.length)return '';
  const tm=e=>e.allDay?'All day':new Date(e.startsAt).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
  let h='';[[t0,'On your calendar today'],[t1,'Tomorrow']].forEach(g=>{const xs=ev.filter(e=>day(e)===g[0]);if(!xs.length)return;
    h+='<div class="label"><span>'+g[1]+'</span></div><div class="routines">'+xs.map(e=>'<div class="routine"><span class="ev-time">'+esc(tm(e))+'</span><span class="r-name">'+esc(e.title)+'</span></div>').join('')+'</div>'});
  return h;
}
function authHTML(){
  if(S.auth==='checking')return '<h1>Timely</h1><p class="sub">Opening your organizer…</p>';
  if(S.auth==='denied')return '<h1>Timely</h1><p class="empty" style="margin:10px 0 16px">This organizer belongs to a different account.</p><button class="btn" data-act="signout">Sign out</button>';
  return '<h1>Timely</h1><p class="sub">Sign in to open your organizer.</p><p id="au-msg" class="note-bar" role="status" style="margin-top:16px"'+(S.authMsg?'':' hidden')+'>'+esc(S.authMsg)+'</p>'+
    '<form class="form" data-form="signin"><div class="fields"><label>Email<input type="email" id="au-email" name="email" autocomplete="username" placeholder="name@example.com" required></label>'+
    '<label>Password<input type="password" id="au-pass" name="password" autocomplete="current-password" minlength="8" required></label></div>'+
    '<div class="row"><button class="btn primary" type="submit" value="in">Sign in</button><button class="btn" type="submit" value="up">Create account</button></div></form>';
}
function setAuthMsg(m){S.authMsg=m;const el=document.getElementById('au-msg');if(el){el.textContent=m;el.hidden=!m}else render()}
async function signin(f,mode){const email=f.elements.email.value.trim(),password=f.elements.password.value;
  if(!email||password.length<8){setAuthMsg('Enter your email and a password of at least 8 characters.');return}
  setAuthMsg(mode==='up'?'Creating your account…':'Signing in…');
  let r;try{r=mode==='up'?await sb.auth.signUp({email:email,password:password,options:{emailRedirectTo:location.origin+location.pathname}}):await sb.auth.signInWithPassword({email:email,password:password})}catch(e){r={error:{message:''}}}
  if(r.error){setAuthMsg(r.error.message||"Couldn't reach the server. Check your connection and try again.");return}
  if(!r.data||!r.data.session)setAuthMsg('Check your email and open the confirmation link. Then come back here and sign in.');
}
function routinesHTML(){const rs=S.routines.slice().sort(ord),wk=weekDates(),t0=today(),L=['M','T','W','T','F','S','S'];
  let h='<div class="label"><span>Routines this week</span><button data-act="editroutines">'+(S.editRoutines?'Done':'Edit')+'</button></div>';
  if(!rs.length&&!S.editRoutines)return h+'<p class="empty">Routines reset every Monday, so a missed day never piles up. Choose Edit to add one.</p>';
  h+='<div class="routines">'+rs.map(r=>{const log=r.log||[],n=wk.filter(d=>log.indexOf(d)>=0).length,id=esc(r.id),tg=r.target||1;
    if(S.editRoutines)return '<div class="routine"><input type="text" class="r-name" id="rn-'+id+'" data-ch="r-name" data-id="'+id+'" value="'+esc(r.name)+'" aria-label="Routine name">'+
      '<span class="stepper"><button data-act="rtarget" data-id="'+id+'" data-d="-1" aria-label="Fewer times a week">−</button>'+tg+' a week<button data-act="rtarget" data-id="'+id+'" data-d="1" aria-label="More times a week">+</button></span>'+
      '<button class="btn danger" data-act="rdel" data-id="'+id+'">Delete</button></div>';
    return '<div class="routine"><span class="r-name">'+esc(r.name)+'</span><span class="week">'+wk.map((d,i)=>'<button class="day'+(d===t0?' today':'')+'" data-act="rlog" data-id="'+id+'" data-d="'+d+'" aria-pressed="'+(log.indexOf(d)>=0)+'" aria-label="'+esc(r.name)+', '+esc(short(parseD(d)))+'"'+(d>t0?' disabled':'')+'>'+L[i]+'</button>').join('')+'</span>'+
      '<span class="r-count'+(n>=tg?' met':'')+'">'+n+' of '+tg+'</span></div>'}).join('')+'</div>';
  if(S.editRoutines)h+='<form class="capture" data-form="addroutine"><input type="text" id="newr" name="q" placeholder="Stretch for ten minutes" aria-label="New routine" autocomplete="off"><button class="btn" type="submit">Add routine</button></form>';
  return h;
}
function projectsHTML(){const open=S.tasks.filter(isOpen),f=S.pf;
  const counts={urgent:open.filter(t=>t.urgent).length,claude:open.filter(t=>t.owner==='claude').length,waiting:open.filter(t=>t.status==='waiting').length};
  const fc=(k,label)=>'<button class="chip" data-act="pf" data-v="'+k+'" aria-pressed="'+(f===k)+'">'+label+(k!=='all'?' <span class="n">'+counts[k]+'</span>':'')+'</button>';
  let h='<h1>Projects</h1><div class="filters">'+fc('all','All')+fc('urgent','Urgent')+fc('claude','For Claude')+fc('waiting','Waiting')+'</div>';
  if(f==='all'){
    const as=areas();
    if(!as.length&&S.status==='ready')h+='<p class="empty" style="margin-top:20px">Each project keeps its own milestones, tasks, and one next step.</p>';
    as.forEach(a=>{h+='<div class="label"><span>'+esc(a.name)+'</span></div><div class="pcards">'+a.items.map(p=>{const n=nextOf(p),cnt=open.filter(t=>t.projectId===p.id).length,q=quietDays(p);
      return '<a class="pcard" href="#p-'+esc(p.id)+'"><span class="pdot" style="background:'+col(p)+'"></span><span class="pc-body"><span class="pc-name">'+esc(p.name)+(q>=10?' <span class="tag quiet">Quiet '+q+' days</span>':'')+'</span><span class="pc-next">'+(n?'Next: '+esc(n.title):'No next step yet')+'</span></span><span class="pc-count">'+(cnt||'')+'</span></a>'}).join('')+'</div>'});
    h+=S.addProject?newProjectHTML():'<p style="margin:22px 0 0"><button class="btn" data-act="addproject">Add project</button></p>';
    const arch=S.projects.filter(p=>p.archived).sort(ord);
    if(arch.length)h+='<div class="label"><span>Archived</span></div>'+arch.map(p=>'<div class="routine"><span class="r-name">'+esc(p.name)+'</span><button class="btn" data-act="unarchive" data-id="'+esc(p.id)+'">Restore</button></div>').join('');
  }else{
    const m=open.filter(t=>f==='urgent'?t.urgent:f==='claude'?t.owner==='claude':t.status==='waiting').sort(cmp);
    if(!m.length)h+='<p class="empty" style="margin-top:20px">'+(f==='urgent'?'Nothing is marked urgent.':f==='claude'?'Nothing is queued for Claude. Open a task and choose For Claude to hand it over.':'Nothing is waiting on anyone.')+'</p>';
    else h+='<div style="margin-top:14px">'+list(m,{proj:true,hz:true})+'</div>';
  }
  return h;
}
function swatches(act,sel,id){return '<div class="swatches">'+Object.keys(COLORS).map(k=>'<button type="button" class="sw" style="background:'+COLORS[k]+'" data-act="'+act+'" data-v="'+k+'"'+(id?' data-id="'+esc(id)+'"':'')+' aria-pressed="'+(k===sel)+'" aria-label="'+k+'"></button>').join('')+'</div>'}
function areaList(){return '<datalist id="areas">'+areas().map(a=>'<option value="'+esc(a.name)+'">').join('')+'</datalist>'}
function newProjectHTML(){return '<form class="form" data-form="addproject"><div class="fields"><label>Name<input type="text" id="np-name" name="q" placeholder="Spring showcase" autocomplete="off"></label><label>Area<input type="text" id="np-area" name="area" list="areas" placeholder="Work" autocomplete="off"></label></div>'+areaList()+swatches('ncolor',S.newColor)+'<div class="row"><button class="btn primary" type="submit">Create project</button><button class="btn" type="button" data-act="addproject">Cancel</button></div></form>'}
function projectHTML(){const p=proj(S.pid),back='<a class="back" href="#projects">'+ic('back',16)+'Projects</a>';
  if(!p)return back+'<p class="empty">'+(S.status==='ready'?'This project is gone. Choose another from Projects.':'')+'</p>';
  const pid=esc(p.id),all=S.tasks.filter(t=>t.projectId===p.id),nx=nextOf(p),mss=S.milestones.filter(m=>m.projectId===p.id).sort(ord);
  let h=back+'<div class="head"><h1><span class="pdot" style="background:'+col(p)+'"></span>'+esc(p.name)+'</h1><button class="link" data-act="editproject">'+(S.editProject?'Done':'Edit')+'</button></div>';
  if(S.editProject)h+='<div class="form"><div class="fields"><label>Name<input type="text" id="pn-'+pid+'" data-ch="p-name" data-id="'+pid+'" value="'+esc(p.name)+'"></label><label>Area<input type="text" id="pa-'+pid+'" data-ch="p-area" data-id="'+pid+'" list="areas" value="'+esc(p.area||'')+'"></label></div>'+areaList()+swatches('pcolor',p.color,p.id)+'<div class="row"><button class="btn danger" data-act="archive" data-id="'+pid+'">Archive project</button></div></div>';
  if(nx){const id=esc(nx.id);h+='<div class="next"><div class="k">Next step</div><div class="t">'+esc(nx.title)+'</div><div class="chips">'+
    '<button class="chip" data-act="toggle" data-id="'+id+'">'+ic('check',14)+'Done</button>'+chip('focus',nx.id,inFocus(nx),'Focus today')+chip('claude',nx.id,nx.owner==='claude',ic('spark',14)+(nx.owner==='claude'?'Queued for Claude':'Send to Claude'))+'</div></div>'}
  else h+='<div class="next"><div class="k">Next step</div><div class="t">'+(all.some(isOpen)?'Everything open is waiting on someone':'Nothing yet')+'</div><div style="color:var(--ink-2);font-size:14px">Add a task below and it becomes the next step.</div></div>';
  const hc=(k,l)=>'<button class="chip" data-act="hz" data-v="'+k+'" aria-pressed="'+(S.hz===k)+'">'+l+'</button>';
  h+='<div class="filters">'+hc('now','Now')+hc('next','Next')+hc('later','Later')+hc('all','All')+'<span class="gap"></span><button class="chip" data-act="urg" aria-pressed="'+S.urg+'">Urgent only</button></div>';
  const vis=t=>(S.hz==='all'||(t.horizon||'now')===S.hz)&&(!S.urg||t.urgent),wk=Date.now()-7*864e5;
  const groups=mss.map(m=>({m:m,ts:all.filter(t=>t.milestoneId===m.id)}));
  groups.push({m:null,ts:all.filter(t=>!mss.some(m=>m.id===t.milestoneId))});
  groups.forEach(g=>{const o=g.ts.filter(t=>isOpen(t)&&vis(t)).sort(cmp),d=g.ts.filter(t=>!isOpen(t)&&Date.parse(t.doneAt||0)>wk).sort((a,b)=>String(b.doneAt).localeCompare(String(a.doneAt)));
    const dn=g.ts.filter(t=>!isOpen(t)).length;
    if(g.m){const mid=esc(g.m.id);h+=S.editProject?'<div class="routine" style="margin-top:22px"><input type="text" class="r-name" id="mn-'+mid+'" data-ch="ms-name" data-id="'+mid+'" value="'+esc(g.m.name)+'" aria-label="Milestone name"><button class="btn danger" data-act="msdel" data-id="'+mid+'">Delete</button></div>':'<div class="label"><span>'+esc(g.m.name)+'</span><span class="r">'+dn+' of '+g.ts.length+'</span></div>'}
    else h+='<div class="label"><span>'+(mss.length?'Other tasks':'Tasks')+'</span>'+(g.ts.length?'<span class="r">'+dn+' of '+g.ts.length+'</span>':'')+'</div>';
    h+=list(o.concat(d),{hz:S.hz==='all'})+addHTML(p.id,g.m?g.m.id:'');
  });
  h+='<form class="capture" data-form="addms" style="margin-top:28px"><input type="text" id="newms" name="q" placeholder="New milestone, like First release" aria-label="New milestone" autocomplete="off"><button class="btn" type="submit">Add milestone</button></form>';
  return h;
}
function inboxHTML(){const ts=S.tasks.filter(t=>isOpen(t)&&!proj(t.projectId)).sort(cmp);
  let h='<h1>Inbox</h1><p class="sub">Catch it now, sort it later.</p>'+captureHTML(false);
  if(!ts.length)return h+'<p class="empty" style="margin-top:22px">Inbox is clear. Add a thought above, or tell Claude to add one for you.</p>';
  return h+'<ul class="tasks" style="margin-top:14px">'+ts.map(t=>taskRow(t).replace(/<\/li>$/,'')+'</li>').join('')+'</ul><p class="empty" style="margin-top:14px;font-size:13.5px">Open a task to move it into a project.</p>';
}
function doneHTML(){const lim=Date.now()-30*864e5,ts=S.tasks.filter(t=>!isOpen(t)&&t.doneAt&&Date.parse(t.doneAt)>lim).sort((a,b)=>String(b.doneAt).localeCompare(String(a.doneAt))).slice(0,300);
  let h='<h1>Done</h1><p class="sub">'+ts.length+' finished in the last 30 days</p>';
  if(!ts.length)return h+'<p class="empty" style="margin-top:22px">Finished tasks collect here, whether you or Claude checked them off.</p>';
  let cur='',buf=[];const flush=()=>{if(buf.length)h+='<div class="label"><span>'+esc(cur)+'</span><span class="r">'+buf.length+'</span></div>'+list(buf,{proj:true});buf=[]};
  ts.forEach(t=>{const d=fmtDay(t.doneAt);if(d!==cur){flush();cur=d}buf.push(t)});flush();
  return h;
}
function mainHTML(){if(S.auth!=='in')return authHTML();return (S.view==='done'?'':'')+statusBar()+(S.view==='projects'?projectsHTML():S.view==='project'?projectHTML():S.view==='inbox'?inboxHTML():S.view==='done'?doneHTML()+'<p class="signout"><button class="link" data-act="signout">Sign out</button></p>':todayHTML())}
function sideHTML(){if(S.auth!=='in')return '';const open=S.tasks.filter(isOpen),inb=open.filter(t=>!proj(t.projectId)).length;
  const a=(href,label,on,n,dot)=>'<a href="#'+href+'"'+(on?' aria-current="page"':'')+'>'+(dot||'')+'<span class="nm">'+esc(label)+'</span>'+(n?'<span class="n">'+n+'</span>':'')+'</a>';
  let h='<div class="brand">Timely</div>'+a('today','Today',S.view==='today')+a('inbox','Inbox',S.view==='inbox',inb)+a('projects','All projects',S.view==='projects')+a('done','Done',S.view==='done');
  areas().forEach(g=>{h+='<div class="slabel">'+esc(g.name)+'</div>'+g.items.map(p=>a('p-'+esc(p.id),p.name,S.view==='project'&&S.pid===p.id,open.filter(t=>t.projectId===p.id).length,'<span class="pdot" style="background:'+col(p)+'"></span>')).join('')});
  return h+'<div class="slabel"></div><button class="link" style="margin-left:8px" data-act="signout">Sign out</button>';
}
function tabsHTML(){if(S.auth!=='in')return '';const inb=S.tasks.filter(t=>isOpen(t)&&!proj(t.projectId)).length;
  const t=(href,icon,label,on)=>'<a href="#'+href+'"'+(on?' aria-current="page"':'')+'>'+ic(icon,22)+'<span>'+label+'</span></a>';
  return t('today','sun','Today',S.view==='today')+t('projects','grid','Projects',S.view==='projects'||S.view==='project')+t('inbox','inbox','Inbox'+(inb?' '+inb:''),S.view==='inbox')+t('done','done','Done',S.view==='done');
}

/* ---------- render ---------- */
let down=false,downAt=0,pending=false,retry=0;
function render(){
  if(down&&Date.now()-downAt<1500){pending=true;clearTimeout(retry);retry=setTimeout(()=>{down=false;if(pending){pending=false;render()}},1600);return}
  const a=document.activeElement;let keep=null;
  if(a&&a.id&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))keep={id:a.id,v:a.value,s:a.selectionStart,e:a.selectionEnd,txt:a.tagName!=='SELECT'&&a.type!=='date'};
  document.getElementById('side').innerHTML=sideHTML();
  document.getElementById('main').innerHTML=mainHTML();
  document.getElementById('tabs').innerHTML=tabsHTML();document.getElementById('tabs').hidden=S.auth!=='in';
  if(keep){const el=document.getElementById(keep.id);if(el){if(keep.txt&&!el.readOnly)el.value=keep.v;el.focus({preventScroll:true});if(keep.txt){try{el.setSelectionRange(keep.s,keep.e)}catch(e){}}}}
}
addEventListener('pointerdown',()=>{down=true;downAt=Date.now()},true);
const release=()=>setTimeout(()=>{down=false;if(pending){pending=false;render()}},0);
addEventListener('pointerup',release,true);addEventListener('pointercancel',release,true);

/* ---------- actions ---------- */
const A={
  toggle(id){const t=task(id);if(!t)return;if(isOpen(t))upd('tasks',id,{status:'done',doneAt:now(),doneBy:'me'});else upd('tasks',id,{status:'open',doneAt:null,doneBy:null})},
  open(id){S.open=S.open===id?null:id;S.confirmDel=null;S.copy=null},
  focus(id){const t=task(id);if(!t)return;if(inFocus(t)){upd('tasks',id,{focusDate:null});return}
    if(S.tasks.filter(inFocus).length>=3){flash('Focus holds three. Finish one or remove its star first.');return}upd('tasks',id,{focusDate:today()})},
  urgent(id){const t=task(id);if(t)upd('tasks',id,{urgent:!t.urgent})},
  waiting(id){const t=task(id);if(t)upd('tasks',id,{status:t.status==='waiting'?'open':'waiting'})},
  claude(id){const t=task(id);if(t)upd('tasks',id,{owner:t.owner==='claude'?'me':'claude'})},
  pin(id){const t=task(id),p=t&&proj(t.projectId);if(p)upd('projects',p.id,{nextTaskId:p.nextTaskId===id?null:id})},
  del(id){S.confirmDel=id},
  delyes(id){write('tasks',id,null,'delete');S.open=null;S.confirmDel=null},
  copy(id){const t=task(id);if(!t)return;const p=proj(t.projectId);
    const text='From my Timely organizer'+(p?' (project: '+p.name+')':'')+': '+t.title+(t.notes?'\nNotes: '+t.notes:'')+'\nWhen it\'s finished, mark this task done in my organizer.';
    const fallback=()=>{S.copy={id:id,text:text};render();const el=document.getElementById('ec-'+id);if(el){el.focus();el.select()}};
    try{navigator.clipboard.writeText(text).then(()=>flashOk('Copied. Paste it into any Claude chat.'),fallback)}catch(e){fallback()}},
  pf(_,el){S.pf=el.dataset.v;S.open=null},
  hz(_,el){S.hz=el.dataset.v},
  urg(){S.urg=!S.urg},
  editroutines(){S.editRoutines=!S.editRoutines},
  rlog(id,el){const r=S.routines.find(x=>x.id===id);if(!r)return;const d=el.dataset.d,cut=addDays(today(),-60);let log=(r.log||[]).filter(x=>x>=cut);
    log=log.indexOf(d)>=0?log.filter(x=>x!==d):log.concat([d]);upd('routines',id,{log:log.sort()})},
  rtarget(id,el){const r=S.routines.find(x=>x.id===id);if(r)upd('routines',id,{target:Math.min(7,Math.max(1,(r.target||1)+Number(el.dataset.d)))})},
  rdel(id){write('routines',id,null,'delete')},
  addproject(){S.addProject=!S.addProject},
  ncolor(_,el){S.newColor=el.dataset.v},
  editproject(){S.editProject=!S.editProject},
  pcolor(id,el){upd('projects',id,{color:el.dataset.v})},
  archive(id){upd('projects',id,{archived:true});S.editProject=false;location.hash='projects'},
  unarchive(id){upd('projects',id,{archived:false})},
  msdel(id){write('milestones',id,null,'delete')},
  signout(){sb.auth.signOut()}
};
function flashOk(m){flash(m)}
document.addEventListener('click',e=>{const el=e.target.closest('[data-act]');if(!el||el.disabled)return;const f=A[el.dataset.act];if(!f)return;f(el.dataset.id,el);render()});
document.addEventListener('change',e=>{const el=e.target,ch=el.dataset&&el.dataset.ch;if(!ch)return;const id=el.dataset.id,v=el.value,tv=v.trim();
  if(ch==='cap-p')S.capP=v;
  else if(ch==='t-title'){if(tv)upd('tasks',id,{title:tv})}
  else if(ch==='t-notes')upd('tasks',id,{notes:v});
  else if(ch==='t-project')upd('tasks',id,{projectId:v||null,milestoneId:null});
  else if(ch==='t-ms')upd('tasks',id,{milestoneId:v||null});
  else if(ch==='t-hz')upd('tasks',id,{horizon:v});
  else if(ch==='t-due')upd('tasks',id,{due:v||null});
  else if(ch==='p-name'){if(tv)upd('projects',id,{name:tv})}
  else if(ch==='p-area'){if(tv)upd('projects',id,{area:tv})}
  else if(ch==='ms-name'){if(tv)upd('milestones',id,{name:tv})}
  else if(ch==='r-name'){if(tv)upd('routines',id,{name:tv})}
  if(ch!=='cap-p')render();
});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.tagName==='INPUT'&&e.target.dataset.ch&&!e.target.form)e.target.blur()});
document.addEventListener('submit',e=>{const f=e.target,k=f.dataset.form;if(!k)return;e.preventDefault();
  if(k==='signin'){signin(f,e.submitter&&e.submitter.value==='up'?'up':'in');return}
  const inp=f.querySelector('[name=q]'),v=((inp&&inp.value)||'').trim();if(!v){if(inp)inp.focus();return}
  if(k==='capture')newTask(v,S.view==='inbox'?null:(S.capP||null),null,'now');
  else if(k==='addtask')newTask(v,f.dataset.pid,f.dataset.ms||null,S.hz==='all'?'now':S.hz);
  else if(k==='addms')write('milestones',slug(S.pid+'-'+v),{projectId:S.pid,name:v,sort:Date.now(),createdAt:now(),updatedAt:now()});
  else if(k==='addroutine')write('routines',null,{name:v,target:3,log:[],sort:Date.now(),updatedAt:now()});
  else if(k==='addproject'){const area=(f.querySelector('[name=area]').value||'').trim()||'Work',id=slug(v);
    write('projects',id,{name:v,area:area,color:S.newColor,sort:Date.now(),archived:false,nextTaskId:null,createdAt:now(),updatedAt:now()});S.addProject=false;inp.value='';location.hash='p-'+id;return}
  inp.value='';render();
});

/* ---------- routing and data ---------- */
function route(first){const h=(location.hash||'').slice(1);
  if(h.indexOf('p-')===0){S.view='project';S.pid=h.slice(2)}else S.view=['today','projects','inbox','done'].indexOf(h)>=0?h:'today';
  S.open=null;S.editProject=false;S.confirmDel=null;S.copy=null;S.urg=false;render();if(first!==true)window.scrollTo(0,0)}
addEventListener('hashchange',route);
document.addEventListener('visibilitychange',()=>{if(document.hidden||S.auth!=='in')return;if(Date.now()-S.loadedAt>20000)loadAll();else render()});
addEventListener('online',()=>{if(S.auth==='in'){loadAll();subscribe()}});

async function loadAll(){
  const since=new Date(Date.now()-45*864e5).toISOString();
  let rs;
  try{rs=await Promise.all(TABLES.map(t=>t==='tasks'?sb.from(t).select('*').or('status.neq.done,done_at.gte.'+since):sb.from(t).select('*')))}catch(e){rs=null}
  if(!rs||rs.some(r=>r.error)){S.status=S.status==='loading'?'error':'stale';render();return}
  TABLES.forEach((t,i)=>{S[t]=rs[i].data.map(fromRow)});
  S.status='ready';S.loadedAt=Date.now();saveCache();render();
}
let chan=null;
function subscribe(){if(chan)return;
  chan=sb.channel('organizer').on('postgres_changes',{event:'*',schema:'public'},p=>{const t=p.table;if(TABLES.indexOf(t)<0)return;
    if(p.eventType==='DELETE'){const id=p.old&&p.old.id;S[t]=S[t].filter(x=>x.id!==id)}
    else{const row=fromRow(p.new),i=S[t].findIndex(x=>x.id===row.id);if(i>=0)S[t][i]=row;else S[t].push(row)}
    saveCache();render()}).subscribe();
}
let entering=false;
async function enter(){
  if(S.auth==='in'||entering)return;entering=true;
  let ok=false,err=false;
  try{const r=await sb.rpc('claim_owner');if(r.error)err=true;else ok=!!r.data}catch(e){err=true}
  entering=false;
  if(err){
    if(lsGet('ns-owner')==='1'&&S.projects.length){S.auth='in';S.status='stale';render();return}
    S.auth='out';S.authMsg="Couldn't reach your organizer. Check your connection and try again.";render();return}
  if(!ok){S.auth='denied';render();return}
  lsSet('ns-owner','1');S.auth='in';S.authMsg='';S.status=S.projects.length?'ready':'loading';render();
  loadAll();subscribe();
}
function leave(){
  const was=S.auth;if(chan){sb.removeChannel(chan);chan=null}
  TABLES.forEach(t=>{S[t]=[]});clearCache();S.auth='out';
  if(was!=='out')render();
}
function boot(){
  loadCache();route(true);
  if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
  sb.auth.onAuthStateChange((ev,session)=>{setTimeout(()=>{if(session)enter();else leave()},0)});
}
boot();
})();
