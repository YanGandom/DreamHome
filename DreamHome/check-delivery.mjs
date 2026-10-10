import fs from 'node:fs';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8'),files=JSON.parse(html.match(/const files=(\[[^;]+\]);/)[1].replaceAll("'",'"'));
const checks=await Promise.all(['index.html','style.css','editor.css','object-controls.css','building.css',...files].map(async file=>{
  const response=await fetch('http://127.0.0.1:4173/'+file,{signal:AbortSignal.timeout(5000)});assert.equal(response.status,200);
  assert.equal(await response.text(),fs.readFileSync(new URL(file,import.meta.url),'utf8'));return file;
}));
console.log(JSON.stringify({httpMatches:checks,version:html.match(/scene.js\?v=([^']+)/)[1]}));
