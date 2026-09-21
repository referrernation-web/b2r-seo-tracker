function parseCSV(t){const rows=[];let r=[],c="",q=false;for(let i=0;i<t.length;i++){const ch=t[i];if(q){if(ch==='"'){if(t[i+1]==='"'){c+='"';i++;}else q=false;}else c+=ch;}else if(ch==='"')q=true;else if(ch===','||ch==='\t'){r.push(c);c="";}else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&t[i+1]==='\n')i++;r.push(c);c="";if(r.some(x=>x!==""))rows.push(r);r=[];}else c+=ch;}r.push(c);if(r.some(x=>x!==""))rows.push(r);return rows;}
function normPath(u){u=String(u||"").trim();try{u=new URL(u).pathname;}catch(e){}return u.replace(/\/+$/,"")||"/";}
// k = "g" (Google) or "b" (Bing). Returns rows matched, or -1 when the file has no clicks/impressions columns.
function importCSV(text,k){
  const rows=parseCSV(text.replace(/^﻿/,""));if(rows.length<2)return 0;
  const h=rows[0].map(x=>x.toLowerCase());
  const ci=h.findIndex(x=>/click/.test(x)),ii=h.findIndex(x=>/impr/.test(x)),pi=h.findIndex(x=>/pos/.test(x));
  if(ci<0||ii<0)return -1;
  const num=v=>parseFloat(String(v||"").replace(/,/g,""))||0;
  const map={};rows.slice(1).forEach(r=>{map[normPath(r[0])]=r;});
  const at=new Date().toISOString().slice(0,10);let n=0;
  STATE.blogs.forEach(d=>{const r=map[normPath(d.slug)];if(!r)return;
    const row=STATE.rows[d.id]=STATE.rows[d.id]||blankRow(d.idxc);row.m=row.m||{};row.mp=row.mp||{};
    if(row.m[k]&&row.m[k].at!==at)row.mp[k]=row.m[k]; // keep the previous import for the ▲▼ trend
    row.m[k]={c:num(r[ci]),i:num(r[ii]),p:pi>=0?num(r[pi]):0,at};n++;});
  return n;
}
function normPath(u){u=String(u||"").trim();try{u=new URL(u).pathname;}catch(e){}return u.replace(/\/+$/,"")||"/";}
// k = "g" (Google) or "b" (Bing). Returns rows matched, or -1 when the file has no clicks/impressions columns.
function importCSV(text,k){
  const rows=parseCSV(text.replace(/^﻿/,""));if(rows.length<2)return 0;
  const h=rows[0].map(x=>x.toLowerCase());
  const ci=h.findIndex(x=>/click/.test(x)),ii=h.findIndex(x=>/impr/.test(x)),pi=h.findIndex(x=>/pos/.test(x));
  if(ci<0||ii<0)return -1;
  const num=v=>parseFloat(String(v||"").replace(/,/g,""))||0;
  const map={};rows.slice(1).forEach(r=>{map[normPath(r[0])]=r;});
  const at=new Date().toISOString().slice(0,10);let n=0;
  STATE.blogs.forEach(d=>{const r=map[normPath(d.slug)];if(!r)return;
    const row=STATE.rows[d.id]=STATE.rows[d.id]||blankRow(d.idxc);row.m=row.m||{};row.mp=row.mp||{};
    if(row.m[k]&&row.m[k].at!==at)row.mp[k]=row.m[k]; // keep the previous import for the ▲▼ trend
    row.m[k]={c:num(r[ci]),i:num(r[ii]),p:pi>=0?num(r[pi]):0,at};n++;});
  return n;
}
function importCSV(text,k){
  const rows=parseCSV(text.replace(/^﻿/,""));if(rows.length<2)return 0;
  const h=rows[0].map(x=>x.toLowerCase());
  const ci=h.findIndex(x=>/click/.test(x)),ii=h.findIndex(x=>/impr/.test(x)),pi=h.findIndex(x=>/pos/.test(x));
  if(ci<0||ii<0)return -1;
  const num=v=>parseFloat(String(v||"").replace(/,/g,""))||0;
  const map={};rows.slice(1).forEach(r=>{map[normPath(r[0])]=r;});
  const at=new Date().toISOString().slice(0,10);let n=0;
  STATE.blogs.forEach(d=>{const r=map[normPath(d.slug)];if(!r)return;
    const row=STATE.rows[d.id]=STATE.rows[d.id]||blankRow(d.idxc);row.m=row.m||{};row.mp=row.mp||{};
    if(row.m[k]&&row.m[k].at!==at)row.mp[k]=row.m[k]; // keep the previous import for the ▲▼ trend
    row.m[k]={c:num(r[ci]),i:num(r[ii]),p:pi>=0?num(r[pi]):0,at};n++;});
  return n;
}
const blankRow=()=>({});
const STATE={rows:{},blogs:[{id:"A1",slug:"/blog/x"},{id:"A2",slug:"/"},{id:"A3",slug:"/blog/none"}]};
const csv='﻿Top pages,Clicks,Impressions,CTR,Position\r\nhttps://s.com/blog/x/,"1,204",5000,2%,7.35\r\nhttps://s.com/,3,40,1%,12.1\r\n';
const assert=require("assert");
assert.strictEqual(importCSV(csv,"g"),2);
assert.deepStrictEqual([STATE.rows.A1.m.g.c,STATE.rows.A1.m.g.i,STATE.rows.A1.m.g.p],[1204,5000,7.35]);
assert.strictEqual(STATE.rows.A2.m.g.p,12.1);
assert.strictEqual(STATE.rows.A3,undefined);
assert.strictEqual(importCSV("Page,Foo\n/a,1\n","b"),-1);
console.log("CSV_CHECK_OK");
