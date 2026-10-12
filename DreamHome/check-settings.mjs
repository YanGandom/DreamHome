import './check-geometry.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {installProgression} from './progression-ui.js';
import {installSettings,SETTINGS_KEY} from './settings.js';
import {createLevelConfig,LEVEL_CONFIG_KEY,validateLevelDraft} from './level-config.js';
import {createProgression} from './progression.js';
import {makeLevelLayout,evaluateLevel} from './levels.js';
import {getLanguage,translate} from './i18n.js';
const app=window.__winterScene,s=app.furnitureSystem,initial=s.serialize(),cases=[];
class Element{constructor(){this.children=[];this.events={};this.hidden=true;this.disabled=false;this.value='';this.attrs={};this.classList={toggle(){}}}append(...v){this.children.push(...v)}replaceChildren(...v){this.children=v}addEventListener(k,f){(this.events[k]??=[]).push(f)}setAttribute(k,v){this.attrs[k]=v}focus(){}async emit(type){for(const fn of this.events[type]||[])await fn({preventDefault(){},stopImmediatePropagation(){},target:this})}async click(){if(!this.disabled)await this.emit('click')}}
const ids=[...fs.readFileSync('index.html','utf8').matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]),nodes=new Map(ids.map(id=>[id,new Element()]));
const doc={hidden:false,createElement:()=>new Element(),getElementById:id=>{assert.ok(nodes.has(id),id);return nodes.get(id)},addEventListener(){}};
const store=new Map(),storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},calls=[],config=createLevelConfig(storage);
const test=async(name,fn)=>{await fn();cases.push(name)},$=id=>nodes.get(id);
const fakeApp={...app,editor:{builder:{catalog:['room','upper','ground','paving','garden','wall','door','flat','gable','chimney'].map(tool=>({id:'tool-'+tool,name:tool,tool}))},refreshLibrary(){}}};
const progress=installProgression(fakeApp,{doc,storage,levelConfig:config,choose:(mode,id)=>{calls.push([mode,id]);return true}});
const settings=installSettings(fakeApp,{doc,storage,progression:progress,levelConfig:config,onConfig:id=>calls.push(['changed',id])});
await test('ordinary level mode opens a centered brief with three tasks and two rewards, without starting the level',async()=>{
 progress.showLevels();assert.equal($('level-picker').hidden,true);assert.equal($('level-brief').hidden,false);assert.equal($('level-brief-tasks').children.length,3);assert.equal($('level-brief-rewards').children.length,2);assert.equal(calls.length,0);
 await $('level-brief-start').click();assert.equal($('level-brief').hidden,true);assert.deepEqual(calls.pop(),['level',1]);
 progress.complete(1);progress.showLevels();assert.ok($('level-brief-title').textContent.includes('第 2 关'));assert.equal($('level-picker').hidden,true);await $('level-brief-close').click();
});
await test('music and effects are independent, persisted switches, and four languages are selectable',async()=>{
 await $('settings-toggle').click();assert.equal($('settings-panel').hidden,false);assert.equal(settings.settings.music,true);await $('settings-music').click();assert.equal(settings.settings.music,false);assert.equal(settings.settings.effects,true);await $('settings-effects').click();assert.deepEqual(JSON.parse(store.get(SETTINGS_KEY)),{music:false,effects:false});
 for(const lang of ['en','es','fr','zh']){$('settings-language').value=lang;await $('settings-language').emit('change');assert.equal(getLanguage(),lang)}
});
await test('codes are exact, AsiDesign opens a real editor without falsely completing or unlocking levels',async()=>{
 $('settings-code').value='asi';await $('settings-code-form').emit('submit');assert.equal(progress.state.unlockAll,undefined);assert.equal($('settings-status').textContent,'代码无效');
 $('settings-code').value='AsiDesign';await $('settings-code-form').emit('submit');assert.equal(progress.state.designUnlocked,true);assert.equal($('design-panel').hidden,false);assert.equal(progress.levelAvailable(3),false);assert.equal(progress.state.counts.levels,1);
});
await test('designer saves task, size, localized names, scene preset and swaps both rewards without duplicates',async()=>{
 $('design-level').value='2';await $('design-level').emit('change');$('design-width').value='9';$('design-depth').value='8';$('design-wallCount').value='2';$('design-preset').value='empty';$('design-task-0').value='place';$('design-target-0').value='3';$('design-task-1').value='lamps';$('design-target-1').value='2';$('design-task-2').value='yellow';$('design-percent').value='40';
 $('design-name-zh').value='测试房间';$('design-name-en').value='Test room';$('design-name-es').value='Habitación de prueba';$('design-name-fr').value='Pièce de test';
 const reward=progress.rewards[5][0].id;$('design-reward-0').value=reward;store.set('dreamhome-level-2-v1','old layout');await $('design-form').emit('submit');
 const level=config.get(2);assert.equal(level.width,9);assert.equal(level.depth,8);assert.equal(level.percent,40);assert.equal(level.tasks[0].target,3);assert.equal(level.preset,'empty');assert.equal(progress.rewards[1][0].id,reward);assert.equal(new Set(progress.rewards.flat().map(r=>r.id)).size,42);assert.equal(store.has('dreamhome-level-2-v1'),false);assert.deepEqual(calls.pop(),['changed',2]);assert.equal(translate('测试房间','fr'),'Pièce de test');
 const loaded=createLevelConfig(storage);assert.deepEqual(loaded.get(2),level);const p=createProgression({catalog:progress.catalog,options:progress.options,storage});assert.equal(p.rewards[1][0].id,reward);assert.equal(p.state.designUnlocked,true);
});
await test('edited task rules govern completion and initial scenes; invalid settings are rejected without partial saves',async()=>{
 const level=config.get(2),baseline=makeLevelLayout(level,initial,progress.catalog);assert.equal(baseline.building.rooms.length,0);const current=structuredClone(baseline);current.building.rooms=[{id:'r',level:1,x:0,z:0,width:9,depth:8}];const lamp=s.catalog().find(r=>r.category==='lighting');
 for(let i=0;i<3;i++)current.items.push({id:'test-'+i,sourceId:lamp.sourceId,visible:true,position:[i,1.03,0],rotation:0,color:i<2?'#d9a449':null});assert.deepEqual(evaluateLevel(level,baseline,current,id=>s.templates.get(id)),[true,true,true]);current.items.at(-1).visible=false;assert.equal(evaluateLevel(level,baseline,current,id=>s.templates.get(id))[0],false);
 const old=store.get(LEVEL_CONFIG_KEY);$('design-width').value='99';await $('design-form').emit('submit');assert.equal(store.get(LEVEL_CONFIG_KEY),old);$('design-width').value='9';$('design-reward-1').value=$('design-reward-0').value;await $('design-form').emit('submit');assert.equal(store.get(LEVEL_CONFIG_KEY),old);
 assert.throws(()=>validateLevelDraft({...config.draft(2),tasks:[{type:'windows',target:1},{type:'place',target:1},{type:'lamps',target:1}]}));
});
await test('Asi unlocks every prop, finish and level, persists independently of completions, and enables level selection followed by a brief',async()=>{
 $('settings-code').value='Asi';await $('settings-code-form').emit('submit');assert.equal(progress.allLevelsAvailable(),true);assert.ok(progress.catalog.every(r=>progress.allowed(r.id)));assert.ok(progress.options.every(r=>progress.finishAllowed(r)));assert.equal(progress.state.counts.levels,1);
 progress.showLevels();assert.equal($('level-picker').hidden,false);assert.equal($('level-list').children.length,21);await $('level-list').children[14].click();assert.equal($('level-picker').hidden,true);assert.ok($('level-brief-title').textContent.includes('第 15 关'));await $('level-brief-start').click();assert.deepEqual(calls.pop(),['level',15]);
 const p=createProgression({catalog:progress.catalog,options:progress.options,storage});assert.equal(p.allLevelsAvailable(),true);assert.equal(p.levelAvailable(21),true);assert.equal(p.state.completed.length,1);
});
settings.audio.dispose();s.load(initial);console.log(JSON.stringify({passed:cases.length,cases,scope:'Actual game state, configuration persistence and simulated form events'},null,2));
