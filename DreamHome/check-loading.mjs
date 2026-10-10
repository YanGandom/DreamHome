import fs from 'node:fs';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8'),start=html.indexOf('async function checkFile('),end=html.indexOf('    try{\n      if(location.protocol',start),source=html.slice(start,end);
const factory=new Function('fetch','location','setTimeout','clearTimeout','AbortController',source+';return checkFile');
function setup(fetch){return factory(fetch,{href:'http://127.0.0.1:4173/?v=test'},(fn,ms)=>{if(ms<10000)queueMicrotask(fn);return 1},()=>{},AbortController)}
let calls=0;
const retry=setup(async()=>{calls++;if(calls===1)throw new TypeError('Failed to fetch');return{ok:true,arrayBuffer:async()=>new ArrayBuffer(0)}});
assert.equal(await retry('wall-handles.js'),'wall-handles.js');assert.equal(calls,2);
calls=0;await assert.rejects(setup(async()=>{calls++;throw new TypeError('Failed to fetch')})('placement.js'),error=>error.message.includes('placement.js')&&error.message.includes('http://127.0.0.1:4173/placement.js')&&error.message.includes('Failed to fetch'));assert.equal(calls,3);
calls=0;await assert.rejects(setup(async()=>{calls++;return{ok:false,status:404}})('missing.js'),/missing.js[\s\S]*HTTP 404/);assert.equal(calls,1);
calls=0;await assert.rejects(setup(async()=>{calls++;return{ok:true,arrayBuffer:async()=>{throw new Error('body disconnected')}}})('scene.js'),/scene.js[\s\S]*body disconnected/);assert.equal(calls,3);
console.log('4 loader checks passed: retry, exact failed URL, missing file, interrupted body');
