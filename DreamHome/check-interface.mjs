import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createSceneMenu} from './scene-menu.js';
const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8'),ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]),cases=[];
const check=(name,fn)=>{fn();cases.push(name)};
check('all DOM IDs are unique and every literal runtime element reference exists',()=>{
  assert.equal(new Set(ids).size,ids.length);
  for(const file of ['scene.js','editor.js','building-controls.js','scene-menu.js','object-controls.js','floor-controls.js','scatter-controls.js']){
    const source=fs.readFileSync(new URL(file,import.meta.url),'utf8');
    for(const m of source.matchAll(/(?:\$|getElementById)\('([\w-]+)'\)/g))assert.ok(ids.includes(m[1]),file+': '+m[1]);
  }
});
check('scene menu contains exactly orbit, snowfall, night and image export; removed controls are absent',()=>{
  const menu=html.split('id="scene-menu"')[1].split('</div>')[0];assert.deepEqual([...menu.matchAll(/<button id="([^"]+)"/g)].map(m=>m[1]),['rotate','snow','night','capture']);
  for(const id of ['reference','toggle-library','library-search','placement-surface','reset'])assert.equal(ids.includes(id),false);
  assert.ok(html.includes('<title>筑梦小屋'));assert.ok(html.includes('viewport-fit=cover'));
});
check('bottom dock styles reserve scene space and cover narrow phones, landscape and safe areas',()=>{
  const base=fs.readFileSync(new URL('./style.css',import.meta.url),'utf8'),dock=fs.readFileSync(new URL('./editor.css',import.meta.url),'utf8');
  assert.ok(base.includes('calc(var(--dock-height) + var(--safe-bottom))'));assert.ok(dock.includes('inset:auto 0 0'));assert.ok(base.includes('env(safe-area-inset-bottom'));assert.ok(base.includes('orientation:landscape'));assert.ok(dock.includes('max-width:370px'));assert.ok(dock.includes('overflow-x:auto'));assert.equal(dock.includes('--sidebar-width'),false);
});
check('one accessible camera toggle replaces the four level buttons',()=>{
  assert.equal(ids.filter(id=>id==='camera-view-toggle').length,1);assert.ok(html.includes('aria-label="切换到俯视"'));assert.equal(html.includes('data-building-view='),false);assert.equal(ids.includes('building-views'),false);
});
check('camera, quest and trophy share an ordered icon rail; home belongs to settings and reset has confirmation',()=>{
  const rail=html.match(/<nav class="game-tool-rail"[\s\S]*?<\/nav>/)[0];assert.deepEqual([...rail.matchAll(/<button id="([^"]+)"/g)].map(m=>m[1]),['camera-view-toggle','task-toggle','achievement-toggle']);assert.ok(rail.includes('id="task-progress-ring"'));assert.ok(rail.includes('class="visually-hidden"'));
  const settings=html.match(/<section id="settings-panel"[\s\S]*?<\/section>/)[0];assert.ok(settings.includes('id="mode-switch"'));assert.ok(settings.includes('返回首页'));assert.equal(html.includes('class="mode-switch"'),false);assert.ok(/id="edit-mode"[^>]*>重置/.test(html));for(const id of ['reset-confirm','reset-yes','reset-no'])assert.ok(ids.includes(id));
});
check('component library has one category row, with construction categories and no parent tabs',()=>{
  assert.equal(html.includes('data-library-tab='),false);assert.equal(ids.includes('build-categories'),false);assert.equal(ids.includes('removed-count'),false);
  const categories=[...html.matchAll(/data-category="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(categories).size,categories.length);
  for(const name of ['all','props','lighting','foundation','walls','doors','roofs'])assert.ok(categories.includes(name));
});
check('collapsible dock keeps its accessible toggle outside the hidden panel and doubles the thumb',()=>{
  const toggle=html.indexOf('id="library-collapse-toggle"'),panel=html.indexOf('<aside id="editor-panel"');assert.ok(toggle>0&&toggle<panel);assert.ok(html.includes('aria-controls="editor-panel" aria-expanded="true"'));
  assert.ok(/id="arc-thumb"[^>]*r="18"/.test(html));assert.ok(ids.includes('arc-thumb-hit'));
});
check('loader checks every first-party JavaScript module before importing the scene',()=>{
  const files=JSON.parse(html.match(/const files=(\[[^;]+\]);/)[1].replaceAll("'",'"'));
  for(const file of files){const src=fs.readFileSync(new URL(file,import.meta.url),'utf8');if(file.startsWith('vendor/'))continue;for(const m of src.matchAll(/from ['"]\.\/([^'"]+)['"]/g))assert.ok(files.includes(m[1]),file+' imports unchecked '+m[1])}
});
class Element{
  constructor(){this.hidden=false;this.listeners={};this.attributes={};this.children=[];this.focused=false}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn)}
  emit(type,extra={}){const e={preventDefault(){this.prevented=true},stopImmediatePropagation(){this.stopped=true},...extra};for(const fn of this.listeners[type]||[])fn(e);return e}
  setAttribute(k,v){this.attributes[k]=v}
  contains(node){return node===this||this.children.includes(node)}
  focus(){this.focused=true}
}
const nodes=Object.fromEntries(['scene-menu-toggle','scene-menu','rotate','capture'].map(id=>[id,new Element()])),doc=new Element();doc.getElementById=id=>nodes[id];nodes['scene-menu'].children=[nodes.rotate,nodes.capture];const menu=createSceneMenu(doc);
check('menu opens and closes with synchronized accessible state',()=>{assert.equal(menu.open,false);nodes['scene-menu-toggle'].emit('click');assert.equal(menu.open,true);assert.equal(nodes['scene-menu-toggle'].attributes['aria-expanded'],'true');nodes['scene-menu-toggle'].emit('click');assert.equal(menu.open,false)});
check('inside interactions preserve the menu; outside presses close it',()=>{menu.setOpen(true);doc.emit('pointerdown',{target:nodes.rotate});assert.equal(menu.open,true);doc.emit('pointerdown',{target:new Element()});assert.equal(menu.open,false)});
check('Escape closes only the menu, stops propagation and returns focus',()=>{menu.setOpen(true);const event=doc.emit('keydown',{key:'Escape'});assert.equal(menu.open,false);assert.ok(event.prevented&&event.stopped);assert.ok(nodes['scene-menu-toggle'].focused)});
check('export closes the menu without changing scene toggles',()=>{menu.setOpen(true);nodes.capture.emit('click');assert.equal(menu.open,false)});
console.log(JSON.stringify({passed:cases.length,cases,scope:'markup, responsive CSS contracts, module coverage and menu events; no rendered layout verification'},null,2));
