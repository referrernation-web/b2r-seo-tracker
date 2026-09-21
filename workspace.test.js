// Regression tests exercise production functions with a mocked transport, not the live DB.
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const main=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
const ui=fs.readFileSync('workspace.js','utf8');
new vm.Script(main);new vm.Script(ui);
const elements=new Map();
const element=id=>{
  if(!elements.has(id))elements.set(id,{textContent:'',className:'',hidden:false,dataset:{},classList:{toggle(){},add(){},remove(){}}});
  return elements.get(id);
};
const context=vm.createContext({assert,console,URL,URLSearchParams,setTimeout,clearTimeout,
  location:{search:'',href:'https://example.com/'},navigator:{onLine:true},
  localStorage:{getItem(){return null;},setItem(){}},
  document:{getElementById:element},window:{addEventListener(){}},
});
vm.runInContext(main.slice(0,main.indexOf('/* ============ TAB + TOOLBAR WIRING')),context);
vm.runInContext(ui.slice(0,ui.indexOf('const root=')),context);
vm.runInContext(ui.slice(ui.indexOf('function allEntries()'),ui.indexOf('function panelShell(')),context);
vm.runInContext(ui.slice(ui.indexOf('function inspectImport('),ui.indexOf('function openImport(')),context);
vm.runInContext(`(async()=>{
  STATE=seedState();
  const before=JSON.stringify(STATE);
  const merged=mergeWithSeed({...STATE,customExtension:{keep:true}});
  assert.equal(merged.customExtension.keep,true,'Preserve unknown saved fields');
  assert.equal(esc('"<tag>'), '&quot;&lt;tag&gt;');
  STATE={blogs:[{id:'a',title:'A',slug:'/a',pri:'P1'},{id:'b',title:'B',slug:'/b',pri:'P2'}],tech:[],newa:[],rows:{a:{status:'todo',assignee:'Michael'},b:{status:'review',assignee:'—',archived:true}}};
  let result=inspectImport('Top pages,Clicks,Impressions,Position\\nhttps://site.com/a/,12,100,4.5\\nhttps://site.com/missing,1,2,3');
  assert.equal(result.matches.length,1);assert.equal(result.unmatched.length,1);
  assert.equal(STATE.rows.a.m,undefined,'Preview must not mutate metrics');
  result=inspectImport('Page,Clicks,Impressions\\n/a,2,4\\n/a,4,5');assert.equal(result.duplicates.length,1);
  result=inspectImport('Page,Clicks,Impressions\\n/a,-2,4');assert.equal(result.invalid.length,1);
  assert.throws(()=>inspectImport('Query,Clicks,Impressions\\nword,2,4'));
  view='work';prefs.preset='all';assert.equal(filteredEntries().length,1);
  prefs.preset='archived';assert.equal(filteredEntries()[0].d.id,'b');
  prefs.preset='mine';me='Michael';assert.equal(filteredEntries()[0].d.id,'a');
  me='';assert.equal(filteredEntries().length,0);prefs.preset='all';
  assert.equal(due({r:{due:''},d:{target:'2026-10-01'}}),'','Explicit clear stays cleared');
  const writes=[];let response={data:[{updated_at:'2026-09-22T00:00:01Z'}]};
  sb={from(){const call={filters:[]};return {update(payload){call.payload=payload;return this;},eq(k,v){call.filters.push([k,v]);return this;},is(k,v){call.filters.push([k,v]);return this;},async select(){writes.push(call);return response;}};}};
  sync.reset('2026-09-22T00:00:00Z');CLIENT='main';sync.queue();assert.equal(await sync.flush(),true);
  assert.equal(writes[0].filters[0][1],'main');assert.equal(writes[0].filters[1][0],'updated_at');assert.equal(sync.dirty,false);
  response={data:[]};sync.queue();assert.equal(await sync.flush(),false);assert.equal(sync.conflict,true);assert.equal(sync.dirty,true);
  const count=writes.length;assert.equal(await sync.flush(),false);assert.equal(writes.length,count,'Conflict prevents blind overwrite');
  sync.reset(null);response={error:new Error('network')};sync.queue();assert.equal(await sync.flush(),false);assert.equal(sync.dirty,true);
  response={data:[{updated_at:'2026-09-22T00:00:02Z'}]};assert.equal(await sync.flush(),true);
  navigator.onLine=false;sync.queue();assert.equal(await sync.flush(),false);assert.equal(sync.dirty,true);navigator.onLine=true;
  await sync.flush();
  // Serialize two edits while the first request is in flight.
  let release;let calls=0;
  sb={from(){return {update(){return this;},eq(){return this;},is(){return this;},select(){calls++;if(calls===1)return new Promise(r=>release=r);return Promise.resolve({data:[{updated_at:'v3'}]});}};}};
  sync.reset('v1');sync.queue();const pending=sync.flush();STATE.rows.a.note='second';sync.queue();release({data:[{updated_at:'v2'}]});
  await pending;assert.equal(calls,2);assert.equal(sync.dirty,false);
  console.log('WORKSPACE_CHECK_OK: preserve, escape, filters, import preview, dates, save, conflict, retry, offline, queued edits');
})()`,context).catch(e=>{console.error(e);process.exitCode=1;});
