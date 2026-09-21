/* Workspace UI. Existing records and Supabase connection policy stay intact. */
const DEMO = new URLSearchParams(location.search).get('demo') === '1';
const LABELS = {todo:'To do',doing:'In progress',review:'Needs review',done:'Done'};
Object.assign(SLABEL, LABELS);
const PRIORITIES = {P0:'Critical',P1:'High',P2:'Normal',P3:'Low'};
const TYPES = {blogs:'Page',tech:'Technical',newa:'Article idea'};
const TITLES = {work:'My work',blogs:'Content library',tech:'Technical tasks',newa:'Article ideas',rank:'Performance',play:'Help',all:'All clients'};
const PRESETS = {all:'All tasks',mine:'Assigned to me',review:'Needs review',blocked:'Blocked',unassigned:'Unassigned',archived:'Archived'};
let prefs = {view:'work',preset:'all',query:'',priority:'all',owner:'all',sort:'priority'};
let panel = null, returnFocus = null, toastTimer;
let refreshRemote = false, taskLinkHandled = false, switchingClient = false;
const $ = id => document.getElementById(id);
const storage = {
  get(key,fallback=null) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key,value) { try { localStorage.setItem(key,JSON.stringify(value)); } catch {} }
};
const prefsKey = () => 'b2r_workspace_v6:' + (DEMO?'demo:':'') + CLIENT;
function savePrefs() { storage.set(prefsKey(),prefs); }
function loadPrefs() { prefs=Object.assign({view:'work',preset:'all',query:'',priority:'all',owner:'all',sort:'priority'},storage.get(prefsKey(),{})); }
function toast(text) { $('ws-toast').textContent=text;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('ws-toast').textContent='',4500); }
function download(name,text,type='application/json') {
  const a=document.createElement('a'),u=URL.createObjectURL(new Blob([text],{type}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);
}

// Optimistic concurrency on the existing updated_at column. Never change schema or RLS.
const sync = {
  version:null, dirty:false, busy:null, conflict:false, timer:null, serial:0,
  reset(version) { this.version=version;this.dirty=false;this.conflict=false;clearTimeout(this.timer);this.notice(); },
  notice(message='') {
    if(!$('sync-banner'))return;
    $('sync-banner').classList.toggle('visible',!!message);
    $('sync-message').textContent=message;
    $('sync-retry').hidden=this.conflict;
  },
  queue() {
    this.dirty=true;this.serial++;clearTimeout(this.timer);
    if(DEMO) { this.dirty=false;setConn('sync','Demo · not saved');return; }
    if(this.conflict) { this.notice('Another session changed this workspace. Your edits are retained here. Download them before reloading.');return; }
    setConn('sync',navigator.onLine?'Saving…':'Offline · edits pending');
    this.timer=setTimeout(()=>this.flush(),450);
  },
  async flush() {
    clearTimeout(this.timer);
    while(this.busy) { await this.busy; if(this.conflict)return false; }
    if(!this.dirty)return true;
    if(this.conflict)return false;
    if(!sb||!navigator.onLine) { setConn('off','Not saved');this.notice('Cannot save right now. Keep this tab open and retry, or download your pending changes.');return false; }
    const client=CLIENT, data=clone(STATE), serial=this.serial;
    const next=new Date(Math.max(Date.now(),(Date.parse(this.version)||0)+1)).toISOString();
    this.busy=(async()=>{
      try {
        let query=sb.from('tracker').update({data,updated_at:next}).eq('id',client);
        query=this.version===null?query.is('updated_at',null):query.eq('updated_at',this.version);
        const result=await query.select('updated_at');
        if(result.error)throw result.error;
        if(!result.data?.length) {
          this.conflict=true;setConn('off','Changes need review');this.notice('Another session changed this workspace. Your edits are retained here. Download pending changes, then reload the latest version.');return false;
        }
        this.version=result.data[0].updated_at;this.dirty=this.serial!==serial;this.notice();
        setConn(this.dirty?'sync':'on',this.dirty?'Saving…':'Saved just now');
        return true;
      } catch(error) {
        setConn('off','Save failed');this.notice('Your edits are still in this tab. Retry saving or download a recovery copy.');return false;
      }
    })();
    const ok=await this.busy;this.busy=null;
    if(ok&&this.dirty)return this.flush();
    return ok;
  }
};
push=()=>sync.queue();
subscribeLive=function() {
  if(channel)sb.removeChannel(channel);
  const client=CLIENT;
  channel=sb.channel('tracker-live-'+client).on('postgres_changes',{event:'UPDATE',schema:'public',table:'tracker',filter:'id=eq.'+client},payload=>{
    if(client!==CLIENT||!payload.new?.data)return;
    // Our own echo can arrive before the update response. Let CAS resolve other writes.
    if(sync.dirty||sync.busy||panel) { refreshRemote=true;return; }
    STATE=mergeWithSeed(payload.new.data);sync.version=payload.new.updated_at;
    render();counts();setConn('on','Updated from team');
  }).subscribe();
};
window.addEventListener('beforeunload',e=>{if(sync.dirty||panel?.dirty){e.preventDefault();e.returnValue='';}});
window.addEventListener('online',()=>{if(sync.dirty&&!sync.conflict)sync.flush();});
window.addEventListener('offline',()=>setConn('off',sync.dirty?'Offline · edits pending':'Offline'));

const root=document.createElement('main');root.id='workspace';root.className='workspace wrap';
$('toolbar').after(root);
const extras=document.createElement('div');
extras.innerHTML=`<div id="sync-banner" class="sync-banner" role="alert"><p id="sync-message"></p><button class="btn ghost" id="sync-retry">Retry save</button><button class="btn ghost" id="sync-backup">Download pending changes</button><button class="btn ghost" id="sync-reload">Reload latest</button></div>
<div class="panel-shade" id="panel-shade" hidden></div>
<section class="detail-panel" id="detail-panel" role="dialog" aria-modal="true" aria-labelledby="panel-heading" hidden></section>
<div class="toast" id="ws-toast" role="status" aria-live="polite"></div>`;
document.body.append(extras);document.querySelector('.tabs').before($('sync-banner'));
$('conn').setAttribute('role','status');$('conn').setAttribute('aria-live','polite');
$('sync-retry').onclick=()=>sync.flush();
$('sync-backup').onclick=()=>download('tracker-pending-'+CLIENT+'.json',JSON.stringify({client:CLIENT,savedAt:new Date().toISOString(),data:STATE},null,2));
$('sync-reload').onclick=()=>reloadLatest(true);
const workTab=document.createElement('button');workTab.className='tab';workTab.dataset.view='work';workTab.textContent='My work';document.querySelector('.tabs .wrap').prepend(workTab);
document.querySelectorAll('.tab').forEach(b=>{b.textContent=TITLES[b.dataset.view];b.onclick=()=>showView(b.dataset.view);});
const settings=document.createElement('details');settings.className='settings-menu';settings.innerHTML='<summary>Settings</summary><div class="settings-items"></div>';
document.querySelector('.who').append(settings);
settings.lastElementChild.append($('invite'),$('reconfig'));
const backupButton=document.createElement('button');backupButton.className='btn ghost';backupButton.textContent='Export full workspace';backupButton.style.color='var(--paper)';
backupButton.onclick=()=>download('tracker-'+CLIENT+'-backup.json',JSON.stringify({client:CLIENT,exportedAt:new Date().toISOString(),data:STATE},null,2));
settings.lastElementChild.append(backupButton);
$('me-name').setAttribute('aria-label','Your display name (not a verified identity)');
$('su-url').setAttribute('aria-label','Supabase project URL');$('su-key').setAttribute('aria-label','Supabase publishable key');
const demoLink=document.createElement('a');demoLink.href='?demo=1';demoLink.textContent='Preview interface with example data';demoLink.style.cssText='display:block;margin-top:16px;color:var(--accent);font-size:13px';document.querySelector('.setup').append(demoLink);

buildCtx=function() {}; // Filters now live in the workspace rather than the legacy grid.
const legacyRender=render;
render=function() {
  if(['rank','all','play'].includes(view)) { if(view==='play')buildPlaybook();else legacyRender();return; }
  renderWorkspace();
};
showView=function(v) {
  if(DEMO&&v==='all'){toast('All-client reporting requires a connected workspace.');return;}
  if(panel&&!closePanel())return;
  view=Object.hasOwn(TITLES,v)?v:'work';prefs.view=view;savePrefs();
  document.querySelectorAll('.tab').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-current',b.dataset.view===view?'page':'false');});
  VIEWS.forEach(v=>$('view-'+v).classList.toggle('hidden',v!==view||['blogs','tech','newa'].includes(v)));
  $('toolbar').style.display='none';$('legend').style.display='none';$('opt-note').style.display='none';
  root.hidden=['rank','all','play'].includes(view);
  renderSide();render();
};
const originalConnect=connect;
connect=async function(url,key) {
  if(DEMO){toast('Leave the preview to connect your team database.');return false;}
  if(sync.dirty&&!(await sync.flush()))return false;
  const ok=await originalConnect(url,key);
  if(ok) {
    loadPrefs();showView(prefs.view);
    if(!taskLinkHandled){
      taskLinkHandled=true;
      const wanted=new URLSearchParams(location.search).get('client');
      if(wanted&&wanted!==CLIENT){
        if(CLIENTS.some(c=>c.id===wanted)){await switchClient(wanted);openTaskLink();return true;}
        toast('That client is not in this workspace.');return true;
      }
      openTaskLink();
    }
  }
  return ok;
};
switchClient=async function(id) {
  if(switchingClient)return;
  if(panel&&!closePanel())return;
  switchingClient=true;
  try {
  if(sync.dirty&&!(await sync.flush()))return;
  if(DEMO) { toast('Client switching is unavailable in the isolated preview.');return; }
  const previous={client:CLIENT,state:STATE,version:sync.version};
  CLIENT=id;loadPrefs();
  if(await connect(CUR_U,CUR_K))localStorage.setItem('b2r_client',id);
  else {CLIENT=previous.client;STATE=previous.state;sync.reset(previous.version);loadPrefs();}
  } finally {switchingClient=false;}
};
async function reloadLatest(discard=false) {
  if(panel&&!closePanel())return;
  if(discard&&sync.dirty) {
    // Explicit second action protects pending work without relying on blocked browser confirms.
    if(!$('sync-reload').dataset.armed) { $('sync-reload').dataset.armed='1';$('sync-reload').textContent='Discard pending edits & reload';return; }
  } else if(sync.dirty&&!(await sync.flush()))return;
  if(!sb||DEMO)return;
  const {data,error}=await sb.from('tracker').select('data,updated_at').eq('id',CLIENT).maybeSingle();
  if(error||!data) { toast('Could not reload. Your current data has been kept.');return; }
  STATE=mergeWithSeed(data.data);sync.reset(data.updated_at);refreshRemote=false;render();counts();setConn('on','Loaded latest');
  delete $('sync-reload').dataset.armed;$('sync-reload').textContent='Reload latest';
}

function allEntries() { return Object.keys(TYPES).flatMap(arr=>(STATE[arr]||[]).map(d=>({arr,d,r:R(d.id)}))); }
function due(e) { return e.r.due??e.d.target??''; }
function title(e) { return e.d.title||e.d.asset||'Untitled task'; }
function owners() { return [...new Set([...ASSIGNEES,...allEntries().map(e=>e.r.assignee||'—')])]; }
function filteredEntries() {
  return allEntries().filter(e=>{
    if(view!=='work'&&e.arr!==view)return false;
    if(prefs.preset==='archived'?!e.r.archived:!!e.r.archived)return false;
    if(prefs.preset==='mine'&&(!me||e.r.assignee!==me))return false;
    if(prefs.preset==='review'&&e.r.status!=='review')return false;
    if(prefs.preset==='blocked'&&!e.r.blocked)return false;
    if(prefs.preset==='unassigned'&&e.r.assignee&&e.r.assignee!=='—')return false;
    if(prefs.owner!=='all'&&(e.r.assignee||'—')!==prefs.owner)return false;
    if(prefs.priority!=='all'&&e.d.pri!==prefs.priority)return false;
    const hay=[title(e),e.d.id,e.d.slug,e.d.task,e.d.kw,e.d.reason,e.d.why,e.r.note,e.r.assignee].join(' ').toLowerCase();
    return !prefs.query||hay.includes(prefs.query.toLowerCase().trim());
  }).sort((a,b)=>prefs.sort==='title'?title(a).localeCompare(title(b)):prefs.sort==='due'?(due(a)||'9999').localeCompare(due(b)||'9999'):(a.d.pri||'P2').localeCompare(b.d.pri||'P2')||title(a).localeCompare(title(b)));
}
function option(value,label,current) { return `<option value="${esc(value)}"${current===value?' selected':''}>${esc(label)}</option>`; }
function renderWorkspace() {
  const entries=filteredEntries();
  root.innerHTML=`${DEMO?'<div class="ws-notice"><b>Interface preview.</b> Example planning records only. Changes stay in memory; no Supabase reads or writes. <a href="?">Return to team login</a></div>':''}
    <div class="ws-top"><div><h2>${esc(TITLES[view]||'My work')}</h2><p class="ws-sub">${view==='work'?'Your next actions across content and technical work.':'Open a task to edit its brief, checklist, and tracking details.'}</p></div><div class="ws-actions"><button class="btn" id="ws-add">Add task</button><button class="btn ghost" id="ws-export">Export</button></div></div>
    <div class="ws-presets" aria-label="Saved views">${Object.entries(PRESETS).map(([k,v])=>`<button data-preset="${k}" aria-pressed="${prefs.preset===k}">${v}</button>`).join('')}</div>
    <div class="ws-filters"><input class="search" id="ws-search" aria-label="Search tasks" placeholder="Search titles, keywords, notes…" value="${esc(prefs.query)}">
    <label>Priority<select id="ws-priority">${option('all','Any priority',prefs.priority)+Object.entries(PRIORITIES).map(([k,v])=>option(k,v,prefs.priority)).join('')}</select></label>
    <label>Owner<select id="ws-owner">${option('all','Everyone',prefs.owner)+owners().map(v=>option(v,v==='—'?'Unassigned':v,prefs.owner)).join('')}</select></label>
    <label>Sort<select id="ws-sort">${[['priority','Priority'],['due','Due date'],['title','Title']].map(([k,v])=>option(k,v,prefs.sort)).join('')}</select></label>
    <button class="btn ghost" id="ws-clear">Clear filters</button></div>
    <div id="ws-results"></div><div class="ws-foot"><span id="ws-count"></span><div class="ws-actions"><button class="btn ghost" id="ws-import">Import metrics</button><button class="btn ghost" id="ws-refresh">Refresh data</button></div></div>`;
  renderResults(entries);
  root.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{prefs.preset=b.dataset.preset;savePrefs();renderWorkspace();});
  $('ws-search').oninput=e=>{prefs.query=e.target.value;savePrefs();renderResults(filteredEntries());};
  ['priority','owner','sort'].forEach(key=>$('ws-'+key).onchange=e=>{prefs[key]=e.target.value;savePrefs();renderResults(filteredEntries());});
  $('ws-clear').onclick=()=>{prefs.preset='all';prefs.query='';prefs.priority='all';prefs.owner='all';savePrefs();renderWorkspace();};
  $('ws-add').onclick=()=>openQuickAdd();$('ws-export').onclick=exportVisible;
  $('ws-import').onclick=openImport;$('ws-refresh').onclick=()=>reloadLatest();
}
function renderResults(entries) {
  $('ws-count').textContent=`${entries.length} task${entries.length===1?'':'s'} shown · ${clientName()}`;
  if(!entries.length) {
    const needName=prefs.preset==='mine'&&!me;
    $('ws-results').innerHTML=`<div class="ws-empty"><h3>${needName?'Choose your display name':'No tasks in this view'}</h3><p>${needName?'Enter your team name in the header to see matching assignments.':'Try another view or clear your filters. Existing records have not been removed.'}</p><button class="btn ghost" id="empty-action">${needName?'Set my name':'Clear filters'}</button></div>`;
    $('empty-action').onclick=()=>needName?$('me-name').focus():$('ws-clear').click();return;
  }
  $('ws-results').innerHTML=`<div class="ws-table-wrap"><table class="ws-table"><caption class="hidden">${esc(TITLES[view])} task list</caption><thead><tr><th scope="col">Task</th><th scope="col">Owner</th><th scope="col">Status</th><th scope="col">Priority</th><th scope="col">Due</th><th scope="col">Action</th></tr></thead><tbody>${entries.map(e=>`<tr>
  <td><button class="ws-title" data-open="${esc(e.d.id)}" data-arr="${e.arr}">${esc(title(e))}</button><span class="ws-meta">${esc(e.d.id)} · ${TYPES[e.arr]}${e.d.kw?' · '+esc(e.d.kw):''}</span></td>
  <td data-label="Owner">${esc(!e.r.assignee||e.r.assignee==='—'?'Unassigned':e.r.assignee)}</td>
  <td data-label="Status"><span class="ws-status ${esc(e.r.status||'todo')}">${esc(LABELS[e.r.status]||'To do')}</span>${e.r.blocked?' <span class="ws-status blocked">Blocked</span>':''}</td>
  <td data-label="Priority">${esc(PRIORITIES[e.d.pri]||'Normal')}</td><td data-label="Due">${esc(due(e)||'Not set')}</td>
  <td><button class="btn ghost" data-open="${esc(e.d.id)}" data-arr="${e.arr}" aria-label="Open ${esc(title(e))}">Open</button></td></tr>`).join('')}</tbody></table></div>`;
  $('ws-results').querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openRecord(b.dataset.arr,b.dataset.open));
}

function panelShell(heading,body,footer) {
  returnFocus=document.activeElement;
  $('detail-panel').innerHTML=`<div class="panel-top"><h2 id="panel-heading">${esc(heading)}</h2><button class="btn ghost" id="panel-close">Close</button></div><div class="panel-body">${body}</div><div class="panel-footer">${footer}</div>`;
  $('detail-panel').hidden=false;$('panel-shade').hidden=false;
  [...document.body.children].filter(e=>e!==extras&&!e.inert&&e.tagName!=='SCRIPT').forEach(e=>{e.inert=true;e.dataset.panelInert='1';});
  document.body.style.overflow='hidden';$('panel-close').onclick=()=>closePanel();
  $('detail-panel').querySelector('input,textarea,select,button')?.focus();
}
function closePanel(force=false) {
  if(panel?.saving)return false;
  if(panel?.dirty&&!force) {
    $('panel-message').textContent='Unsaved changes. Save them or discard before closing.';
    if(!$('panel-discard')) { const b=document.createElement('button');b.id='panel-discard';b.className='btn ghost danger';b.textContent='Discard changes';b.onclick=()=>closePanel(true);document.querySelector('.panel-footer').append(b); }
    return false;
  }
  panel=null;$('detail-panel').hidden=true;$('panel-shade').hidden=true;document.body.style.overflow='';
  document.querySelectorAll('[data-panel-inert]').forEach(e=>{e.inert=false;delete e.dataset.panelInert;});
  if(returnFocus?.isConnected)returnFocus.focus();else $('ws-add')?.focus();
  if(refreshRemote&&!sync.dirty&&!sync.busy) { refreshRemote=false;reloadLatest(); }
  return true;
}
$('panel-shade').onclick=()=>closePanel();
document.addEventListener('keydown',e=>{
  if(!panel)return;
  if(e.key==='Escape'){e.preventDefault();closePanel();}
  if(e.key==='Tab') {
    const nodes=[...$('detail-panel').querySelectorAll('button,input,select,textarea,a[href],summary')].filter(n=>!n.disabled&&n.getClientRects().length);
    if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1)?.focus();}
    else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0]?.focus();}
  }
});
function field(label,key,value,{area=false,type='text',options=null,scope='d'}={}) {
  const attrs=`data-scope="${scope}" data-field="${key}"`;
  return `<label class="field"><span>${esc(label)}</span>${options?`<select ${attrs}>${options.map(([k,v])=>option(k,v,value)).join('')}</select>`:area?`<textarea ${attrs}>${esc(value||'')}</textarea>`:`<input type="${type}" ${attrs} value="${esc(value||'')}">`}</label>`;
}
function openRecord(arr,id) {
  const d=STATE[arr]?.find(x=>x.id===id);if(!d)return;
  panel={kind:'record',arr,id,d:clone(d),r:clone(R(id)),dirty:false};
  const p=panel;
  const rowField=(label,key,opts={})=>field(label,key,p.r[key],{...opts,scope:'r'});
  const ownerOpts=owners().map(a=>[a,a==='—'?'Unassigned':a]);
  const checklist=p.r.checklist||[];
  const tracking=arr==='tech'?'':`<details><summary>Indexing & backlinks</summary><div><p class="ws-sub">Status is manually recorded. Dates describe the recorded check/submission, not a live verification.</p>${['g','bing','yandex'].map((engine,i)=>`<div class="field-row">${field(['Google','Bing','Yandex'][i],engine+'-s',p.r[engine]?.s||'unknown',{scope:'engine',options:[['unknown','Not checked'],...IDXOPTS]})}${field('Recorded date',engine+'-d',p.r[engine]?.d||'',{scope:'engine'})}</div>`).join('')}${rowField('Backlinks built','blBuilt')}${rowField('Backlink target','blTarget')}${rowField('Backlink type','blType')}</div></details>`;
  panelShell('Task details',`<p class="ws-sub">${esc(id)} · ${TYPES[arr]}</p>
    ${field('Title',arr==='tech'?'asset':'title',title({d}))}
    <div class="field-row">${rowField('Owner','assignee',{options:ownerOpts})}${rowField('Status','status',{options:Object.entries(LABELS)})}</div>
    <div class="field-row">${field('Priority','pri',d.pri,{options:Object.entries(PRIORITIES)})}${rowField('Due date','due',{type:'date'})}</div>
    <label class="check"><input id="task-blocked" type="checkbox"${p.r.blocked?' checked':''}>Blocked — needs help</label>
    ${rowField('Blocker / help needed','blockReason',{area:true})}
    ${field('Next action','task',d.task,{area:true})}
    ${field(arr==='tech'?'Issue':arr==='newa'?'Opportunity':'Reason / brief',arr==='tech'?'issue':arr==='newa'?'why':'reason',d.issue||d.why||d.reason,{area:true})}
    ${field('Target keyword','kw',d.kw)}
    ${arr==='blogs'?field('URL / slug','slug',d.slug)+field('Page type','grp',d.grp,{options:[['A','Blog'],['B','Course / money page'],['C','Test page']]}) : arr==='tech'?field('Technical type','type',d.type,{options:[['Site','Site'],['Platform','Platform'],['Schema','Schema']]}):field('Intent','intent',d.intent,{options:[...new Set(['Commercial','Guide',d.intent].filter(Boolean))].map(v=>[v,v])})}
    <h3>Completion checklist</h3><div id="checklist-items">${checklist.map((c,i)=>`<label class="check"><input type="checkbox" data-check="${i}"${c.done?' checked':''}>${esc(c.text)}</label>`).join('')}</div>
    <div class="field-row"><label class="field"><span>Add a check</span><input id="checklist-new" placeholder="What must be true before this is done?"></label><button class="btn ghost" id="checklist-add">Add</button></div>
    ${rowField('Sources / evidence links','evidence',{area:true})}${rowField('Team notes','note',{area:true})}
    ${tracking}
    ${arr==='blogs'?`<details><summary>Existing workflow guidance</summary><div><p class="ws-sub">Retained from the original playbook; verify recommendations before applying.</p><ol class="import-list">${flowFor(d).steps.map(step=>`<li>${esc(step)}</li>`).join('')}</ol></div></details>`:''}
    ${arr==='blogs'?`<details><summary>Performance & AI observations</summary><div>${mrow(id,'g','Google')}${mrow(id,'b','Bing')}<p class="ws-sub">Manual observations below are not citation counts.</p>${AIS.map(([key,label])=>`<label class="check"><input type="checkbox" data-ai="${key}"${p.r.ai?.[key]?' checked':''}>${label} citation observed</label>`).join('')}${field('Keyword coverage notes','haskw',d.haskw)}</div></details>`:''}
    ${arr==='newa'?`<details><summary>Article dates</summary><div>${['created','updated','target'].map(k=>field(k[0].toUpperCase()+k.slice(1),k,d[k],{type:'date'})).join('')}</div></details>`:''}
    <details><summary>Record actions</summary><div class="ws-actions"><button class="btn ghost" id="task-link">Copy task link</button><button class="btn ghost danger" id="task-archive">${p.r.archived?'Restore task':'Archive task'}</button></div><p class="ws-sub">Archive is reversible from the Archived view. Display names are self-reported.</p></details>`,
    '<span class="panel-message" id="panel-message">Changes save when you choose Save changes.</span><button class="btn" id="panel-save">Save changes</button>');
  // Existing target dates remain visible as the effective due date unless explicitly replaced.
  if(p.r.due==null&&d.target)$('detail-panel').querySelector('[data-field="due"]').value=d.target;
  $('detail-panel').querySelectorAll('[data-field]').forEach(el=>el.oninput=()=>{
    const {scope,field:key}=el.dataset;
    if(scope==='engine') {const [engine,f]=key.split('-');p.r[engine]=p.r[engine]||{s:'unknown',d:''};p.r[engine][f]=el.value;}
    else p[scope][key]=el.value;
    p.dirty=true;
  });
  const wireChecks=()=>$('checklist-items').querySelectorAll('[data-check]').forEach(el=>el.onchange=()=>{p.r.checklist[+el.dataset.check].done=el.checked;p.dirty=true;});
  wireChecks();
  $('checklist-add').onclick=()=>{const value=$('checklist-new').value.trim();if(!value)return;p.r.checklist=p.r.checklist||[];p.r.checklist.push({text:value,done:false});p.dirty=true;$('checklist-new').value='';$('checklist-items').innerHTML=p.r.checklist.map((c,i)=>`<label class="check"><input type="checkbox" data-check="${i}"${c.done?' checked':''}>${esc(c.text)}</label>`).join('');wireChecks();};
  $('task-blocked').onchange=e=>{p.r.blocked=e.target.checked;p.dirty=true;};
  $('detail-panel').querySelectorAll('[data-ai]').forEach(el=>el.onchange=()=>{p.r.ai=p.r.ai||{};p.r.ai[el.dataset.ai]=el.checked;p.dirty=true;});
  $('task-archive').onclick=()=>{p.r.archived=!p.r.archived;p.dirty=true;$('task-archive').textContent=p.r.archived?'Restore task':'Archive task';$('panel-message').textContent='Choose Save changes to apply. Archive can be undone from the Archived view.';};
  $('task-link').onclick=async()=>{
    const u=new URL(location.href);u.hash='';u.search='';u.searchParams.set('client',CLIENT);u.searchParams.set('task',id);u.searchParams.set('type',arr);
    try {await navigator.clipboard.writeText(u.href);toast('Task link copied. The recipient still needs existing workspace access.');}catch{toast('Clipboard unavailable. Copy the task ID: '+id);}
  };
  $('panel-save').onclick=async()=>{
    if(!String(p.d.title||p.d.asset||'').trim()){ $('panel-message').textContent='Enter a task title.';return; }
    if(p.r.blocked&&!String(p.r.blockReason||'').trim()){ $('panel-message').textContent='Describe what is blocking this task.';return; }
    if(p.r.status==='done'&&p.r.checklist?.some(c=>!c.done)){ $('panel-message').textContent='Complete the checklist before marking this task done.';return; }
    const current=STATE[arr].find(x=>x.id===id);if(!current){toast('This task is no longer available.');return;}
    Object.assign(current,p.d);STATE.rows[id]=p.r;p.r.changedAt=new Date().toISOString();p.r.by=me?('Updated by '+me):p.r.by;
    if(arr==='newa')current.updated=new Date().toISOString().slice(0,10);
    p.dirty=false;p.saving=true;push();counts();render();
    $('detail-panel').querySelectorAll('input,textarea,select,button').forEach(el=>el.disabled=true);
    const ok=await sync.flush();p.saving=false;
    if(ok){closePanel(true);toast(DEMO?'Preview updated — not saved to your database.':'Task saved.');}
    else { $('detail-panel').querySelectorAll('input,textarea,select,button').forEach(el=>el.disabled=false);$('panel-message').textContent='Not saved to the server. Close this panel to use the recovery controls above the workspace.'; }
  };
}

const TEMPLATES={blogs:['Confirm the page brief','Review sources and accuracy','Verify the live URL'],tech:['Document the issue','Verify the fix','Record the evidence'],newa:['Define the buyer question','Review the draft','Approve for publication']};
function openQuickAdd() {
  panel={kind:'add',dirty:false};
  const arr=Object.hasOwn(TYPES,view)?view:'blogs';
  panelShell('Add a task',`${field('Title','title','')} ${field('Template','arr',arr,{options:Object.entries(TYPES)})}${field('Owner','owner','—',{options:owners().map(a=>[a,a==='—'?'Unassigned':a])})}<p class="ws-sub">Start with the basics. A short checklist is included; fill the rest in task details.</p>`, '<span class="panel-message" id="panel-message"></span><button class="btn" id="quick-save">Create task</button>');
  $('detail-panel').querySelectorAll('input,select').forEach(el=>el.oninput=()=>panel.dirty=true);
  $('quick-save').onclick=()=>{
    const get=k=>$('detail-panel').querySelector(`[data-field="${k}"]`).value;
    const text=get('title').trim(),arr=get('arr');if(!text){$('panel-message').textContent='Enter a title to continue.';return;}
    const id=(arr==='tech'?'T':arr==='newa'?'N':'P')+'-'+crypto.randomUUID();
    const d={id,pri:'P2',kw:'',task:'',created:new Date().toISOString().slice(0,10)};
    if(arr==='tech')Object.assign(d,{asset:text,type:'Site',issue:''});
    else Object.assign(d,{title:text,slug:'',grp:'A',reason:'',why:'',intent:'Commercial',cat:'Commercial'});
    STATE[arr].push(d);STATE.rows[id]={...blankIdx(),...blankMeta(),assignee:get('owner'),checklist:TEMPLATES[arr].map(text=>({text,done:false})),g:{s:'unknown',d:''},bing:{s:'unknown',d:''},yandex:{s:'unknown',d:''}};
    closePanel(true);push();counts();render();openRecord(arr,id);
  };
}
function exportVisible() {
  const rows=[['ID','Type','Title','Owner','Status','Priority','Due','Next action'],...filteredEntries().map(e=>[e.d.id,TYPES[e.arr],title(e),e.r.assignee,LABELS[e.r.status||'todo'],PRIORITIES[e.d.pri],due(e),e.d.task])];
  // Spreadsheet formulas are escaped for team-authored text.
  const safe=v=>q(/^[=+@\-\t\r]/.test(String(v||''))?"'"+v:v);
  download('tracker-'+CLIENT+'-view.csv',rows.map(r=>r.map(safe).join(',')).join('\r\n'),'text/csv;charset=utf-8');
}
function inspectImport(text) {
  const rows=parseCSV(text.replace(/^\uFEFF/,''));if(rows.length<2)throw Error('The file has no data rows.');
  const h=rows[0].map(v=>v.toLowerCase().trim());
  const ci=h.findIndex(v=>/click/.test(v)),ii=h.findIndex(v=>/impr/.test(v)),pi=h.findIndex(v=>/pos/.test(v));
  const ui=h.findIndex(v=>/^(top pages|page|pages|url)$/.test(v));
  if(ci<0||ii<0||ui<0)throw Error('Export a Pages report with URL/Page, Clicks and Impressions columns.');
  const seen=new Set(),duplicates=[],unmatched=[],matches=[],invalid=[];
  const num=v=>Number(String(v||'0').replace(/,/g,''));
  rows.slice(1).forEach(r=>{
    if(!String(r[ui]||'').trim()){invalid.push('Empty URL');return;}
    const path=normPath(r[ui]);if(seen.has(path)){duplicates.push(path);return;}seen.add(path);
    const c=num(r[ci]),i=num(r[ii]),p=pi<0?0:num(r[pi]);
    if([c,i,p].some(v=>!Number.isFinite(v)||v<0)){invalid.push(path);return;}
    const found=STATE.blogs.filter(d=>d.slug&&normPath(d.slug)===path);
    if(found.length!==1){unmatched.push(path);return;}
    matches.push({id:found[0].id,title:found[0].title,path,c,i,p});
  });
  return {matches,duplicates,unmatched,invalid};
}
function openImport() {
  panel={kind:'import',dirty:false,preview:null};const p=panel;
  panelShell('Import search metrics',`<p class="ws-sub">Export the Pages report from Google Search Console or Bing Webmaster Tools. Review matches before changing any record. URLs match existing page paths.</p>
    ${field('Source','source','g',{options:[['g','Google Search Console'],['b','Bing Webmaster Tools']]})}
    <div class="field-row">${field('Report start','start','',{type:'date'})}${field('Report end','end','',{type:'date'})}</div>
    <label class="field"><span>CSV / TSV file</span><input id="import-file" type="file" accept=".csv,.tsv,.txt"></label><div id="import-preview" role="status">Choose a file to preview.</div>`,
    '<span class="panel-message" id="panel-message">No changes until you apply the preview.</span><button class="btn" id="import-apply" disabled>Apply import</button>');
  $('import-file').onchange=async e=>{
    $('import-apply').disabled=true;
    try {
      const file=e.target.files[0];if(!file)return;
      if(file.size>5*1024*1024)throw Error('Use a file smaller than 5 MB.');
      p.preview=inspectImport(await file.text());const x=p.preview;
      $('import-preview').innerHTML=`<h3>${x.matches.length} records will update</h3><p>${x.unmatched.length} unmatched or ambiguous · ${x.duplicates.length} duplicate URLs · ${x.invalid.length} invalid rows</p><ul class="import-list">${x.matches.slice(0,50).map(m=>`<li>${esc(m.title)} — ${m.c} clicks / ${m.i} impressions</li>`).join('')}</ul>${x.unmatched.length?'<p>Unmatched: '+x.unmatched.slice(0,10).map(esc).join(', ')+'</p>':''}${x.duplicates.length||x.invalid.length?'<p>Fix duplicate or invalid rows before importing. Nothing has changed.</p>':''}`;
      $('import-apply').disabled=!x.matches.length||!!x.duplicates.length||!!x.invalid.length;
    } catch(error) {p.preview=null;$('import-preview').textContent=error.message;}
  };
  $('import-apply').onclick=async()=>{
    const get=k=>$('detail-panel').querySelector(`[data-field="${k}"]`).value;
    const start=get('start'),end=get('end'),kind=get('source');
    if(!start||!end||start>end){$('panel-message').textContent='Set a valid reporting start and end date.';return;}
    if(!p.preview?.matches.length)return;
    for(const m of p.preview.matches){
      const r=STATE.rows[m.id]||(STATE.rows[m.id]=blankRow());r.m=r.m||{};r.mp=r.mp||{};
      if(r.m[kind])r.mp[kind]=clone(r.m[kind]);
      r.m[kind]={c:m.c,i:m.i,p:m.p,at:new Date().toISOString().slice(0,10),start,end};
    }
    p.saving=true;push();render();$('import-apply').disabled=true;const ok=await sync.flush();p.saving=false;
    closePanel(true);if(ok)toast('Metrics imported. Reporting dates are recorded in each page.');
  };
}
// Keep reporting truthful without changing any measured values or saved plans.
mrow=function(id,k,lab) {
  const m=R(id).m?.[k];if(!m)return `<p class="ws-sub">${lab}: no imported data</p>`;
  return `<p class="ws-sub"><b>${lab}: ${esc(m.c)} clicks</b> · ${esc(m.i)} impressions · average position ${m.p?Number(m.p).toFixed(1):'—'}<br>${m.start&&m.end?esc(m.start)+' to '+esc(m.end):'Reporting period not recorded'} · imported ${esc(m.at||'unknown')}</p>`;
};
const originalRank=renderRank;
renderRank=function() { originalRank();const el=$('view-rank');el.innerHTML=el.innerHTML.replace(/\(28-day window\)/g,'(reporting dates depend on the import)').replace(/By assignee — whose work is ranking/g,'Results grouped by current assignee').replace(/On page 1/g,'Avg. position ≤ 10').replace(/AI citations/g,'AI engine observations').replace(/"Page 1" = Google position 10 or better\./g,'Average position is not a live ranking. Assignment does not establish who caused these results.'); };
const oldMeInput=meEl.oninput;
meEl.oninput=()=>{oldMeInput();if(!root.hidden&&prefs.preset==='mine')renderResults(filteredEntries());};
function openTaskLink() {
  const args=new URLSearchParams(location.search),id=args.get('task'),arr=args.get('type');
  if(id&&Object.hasOwn(TYPES,arr)&&STATE[arr].some(d=>d.id===id))openRecord(arr,id);
}
loadPrefs();
if(DEMO) {
  STATE=seedState();me='Michael';meEl.value=me;
  const examples=allEntries();if(examples[0]){examples[0].r.assignee='Michael';examples[0].r.status='doing';}
  if(examples[1])examples[1].r.status='review';
  showSetup(false);setConn('sync','Demo · not saved');counts();showView(prefs.view);
} else {
  boot();
  showView(prefs.view);
}
