import './check-geometry.mjs';
import assert from 'node:assert/strict';
import {createProgression,ACHIEVEMENTS,filterCustomUnlocks,decorateLock} from './progression.js';
import {LEVELS,makeLevelLayout,evaluateLevel} from './levels.js';
import {installProgression} from './progression-ui.js';
const app=window.__winterScene,s=app.furnitureSystem,b=s.construction,initial=s.serialize(),cases=[];
const test=(name,fn)=>{fn();cases.push(name)};
const tools=['room','upper','ground','paving','garden','wall','door','flat','gable','chimney'].map(tool=>({id:'tool-'+tool,name:tool,tool,category:tool}));
const store=new Map(),storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
class Element{constructor(){this.children=[];this.events={};this.hidden=true;this.classes=new Set();this.classList={toggle:(key,on)=>on?this.classes.add(key):this.classes.delete(key)}}append(...v){this.children.push(...v)}replaceChildren(...v){this.children=v}addEventListener(k,f){this.events[k]=f}focus(){}setAttribute(){}click(){this.events.click?.()}}
const nodes=new Map(),doc={createElement:()=>new Element(),getElementById:id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id)},addEventListener(){}};
const p=installProgression({...app,editor:{builder:{catalog:tools},refreshLibrary(){}}},{doc,storage,choose(){}});
test('84 catalog entries: exactly half locked, 21 unique pairs of prop rewards',()=>{
 assert.equal(p.catalog.length,84);assert.equal(p.locked.length,42);assert.equal(p.rewards.length,21);assert.ok(p.rewards.every(r=>r.length===2));assert.equal(new Set(p.rewards.flat().map(r=>r.id)).size,42);
 assert.equal(s.catalog().filter(r=>r.id.startsWith('suite-')).length,26);assert.equal(s.catalog().find(r=>r.id==='balcony-railing').category,'railings');
 for(const cat of ['seating','tables','lighting','plants'])assert.ok(p.catalog.some(r=>r.category===cat&&p.allowed(r.id)));
});
test('one third of finish options are gated; essential theme colors and floor materials are available',()=>{
 assert.equal(p.finishes.length,Math.floor(p.options.length/3));for(const id of ['#d9a449','#437244','#e7d5af','wood-planks','tile-checker'])assert.ok(p.finishAllowed(id));
 assert.ok(ACHIEVEMENTS.every(a=>[...p.optionAchievements.values()].some(v=>v.id===a.id)),'each achievement grants a finish');
});
test('locked items and finishes are blocked in mutation APIs, with an acquisition message',()=>{
 const locked=p.locked.find(r=>!r.id.startsWith('tool-')&&!r.id.startsWith('scatter-'));assert.equal(s.add(locked.sourceId),false);assert.equal(s.beginPlacement(locked.sourceId,'catalog'),false);
 const finish=p.finishes.find(id=>id.startsWith('#'));s.setColor('salon-sofa',finish);assert.equal(s.get('salon-sofa').color,null);assert.ok(doc.getElementById('reward-notice-text').textContent.includes('成就'));
});
test('all 20 new levels load real editable rooms or empty plots and can be solved using unlocked starters',()=>{
 for(const level of LEVELS.slice(1)){
  const baseline=makeLevelLayout(level,initial,p.catalog);assert.ok(s.load(baseline));const current=s.serialize();assert.equal(evaluateLevel(level,baseline,current,id=>s.templates.get(id)).every(Boolean),false);
  if(!current.building.rooms.length)current.building.rooms=[{id:'build-room-test',type:'room',x:0,z:0,width:level.width,depth:level.depth,level:1,floorStyle:'wood-planks'}];
  const room=current.building.rooms[0];current.building.walls=Array.from({length:level.wallCount},(_,i)=>({id:'build-wall-test-'+i,rooms:[room.id]}));
  const color={yellow:'#d9a449',green:'#437244',cream:'#e7d5af'}[level.theme]||'#d9a449';
  current.items.filter(i=>i.visible).forEach(i=>i.color=color);
  for(const [category,count]of Object.entries(level.counts)){const source=p.catalog.find(r=>r.category===category&&r.kind==='furniture'&&p.allowed(r.id));assert.ok(source);for(let i=0;i<count;i++)current.items.push({id:category+'-'+i,sourceId:source.sourceId,position:[(i%3)-1,1.03,Math.floor(i/3)],rotation:Math.PI/6,visible:true,color});}
  if(level.theme==='tile'||level.renew)room.floorStyle='tile-checker';if(level.theme==='tile')room.floorRotation=90;
  assert.deepEqual(evaluateLevel(level,baseline,current,id=>s.templates.get(id)),[true,true,true],level.name);
  const invalid=structuredClone(current);invalid.building.rooms[0].width=20.5;assert.equal(evaluateLevel(level,baseline,invalid,id=>s.templates.get(id))[0],false);
 }
});
test('theme ratio requires strictly over 30 percent and ignores furniture outside the room',()=>{
 const level=LEVELS.find(l=>l.theme==='yellow'),baseline=makeLevelLayout(level,initial,p.catalog),layout=structuredClone(baseline);layout.items.forEach(i=>i.visible=false);
 for(let i=0;i<10;i++)layout.items.push({id:'theme-'+i,sourceId:'salon-sofa',visible:true,position:[0,1.03,0],rotation:0,color:i<3?'#d9a449':null});
 assert.equal(evaluateLevel(level,baseline,layout,id=>s.templates.get(id))[2],false);layout.items.at(-1).color='#d9a449';assert.equal(evaluateLevel(level,baseline,layout,id=>s.templates.get(id))[2],true);layout.items.at(-1).position=[50,1.03,50];assert.equal(evaluateLevel(level,baseline,layout,id=>s.templates.get(id))[2],true); // 3 of 9
});
test('rewards persist, repeat completion is idempotent and custom uses the same unlock map',()=>{
 assert.equal(p.levelAvailable(2),false);assert.equal(p.complete(1),true);assert.equal(p.complete(1),false);assert.equal(p.state.counts.levels,1);assert.ok(p.rewards[0].every(r=>p.allowed(r.id)));assert.equal(p.levelAvailable(2),true);
 const loaded=createProgression({catalog:p.catalog,options:p.options,storage});assert.deepEqual(loaded.state.completed,[1]);assert.ok(loaded.rewards[0].every(r=>loaded.allowed(r.id)));
});
test('confirmed action destinations count once across undo/replay and progress reload',()=>{
 const before={items:[]},after={items:[{id:'lamp-1',sourceId:s.catalog().find(r=>r.category==='lighting').id,visible:true,rotation:0,color:null}]};
 p.record(before,after,id=>s.templates.get(id),'test');p.record(before,after,id=>s.templates.get(id),'test');assert.equal(p.state.counts.placements,1);assert.equal(p.state.counts.lights,1);
 const rotated=structuredClone(after);rotated.items[0].rotation=Math.PI/6;p.record(after,rotated,id=>s.templates.get(id),'test');p.record(after,rotated,id=>s.templates.get(id),'test');assert.equal(p.state.counts.rotations,1);
});
test('level dimensions constrain the live native construction APIs but do not restrict custom mode',()=>{
 s.levelRule=LEVELS[1];s.load(makeLevelLayout(LEVELS[1],initial,p.catalog));const room=b.all()[0];assert.equal(b.updateRoom(room.id,{width:7}),false);s.levelRule=null;assert.ok(b.updateRoom(room.id,{width:7}));
});
test('legacy custom layouts retain locked models in storage and locked buttons explain their acquisition route',()=>{
 const reward=p.locked.find(r=>!p.allowed(r.id)&&r.sourceId&&!r.id.startsWith('scatter-')),layout=structuredClone(initial);layout.items.push({id:'legacy-locked',sourceId:reward.sourceId,visible:true,position:[0,1.03,0],rotation:0,color:null});
 const filtered=filterCustomUnlocks(layout,p,id=>s.templates.get(id));assert.equal(filtered.items.at(-1).visible,false);assert.equal(layout.items.at(-1).visible,true);
 const button=new Element();assert.equal(decorateLock(button,p,reward.id),true);assert.ok(button.classes.has('reward-locked'));assert.ok(button.title.includes('关'));
});
test('achievement thresholds unlock the actual finish APIs and each combination model clones and saves correctly',()=>{
 for(const a of ACHIEVEMENTS)p.state.counts[a.metric]=Math.max(p.state.counts[a.metric]||0,a.target);
 for(const finish of p.finishes)assert.ok(p.finishAllowed(finish));const color=p.finishes.find(id=>id.startsWith('#'));s.setColor('salon-sofa',color);assert.equal(s.get('salon-sofa').color,color);
 for(let n=2;n<=21;n++)assert.equal(p.complete(n),true);
 const roots=new Set();for(const item of s.catalog().filter(r=>r.id.startsWith('suite-'))){const r=s.add(item.id);assert.ok(r);assert.ok(!roots.has(r.root));roots.add(r.root);assert.ok(r.localBounds.min.toArray().every(Number.isFinite));assert.ok(r.localBounds.max.toArray().every(Number.isFinite));assert.ok(r.paint.length>0)}
 const saved=s.serialize();assert.ok(s.loadSaved(saved));assert.deepEqual(s.serialize(),saved);
});
s.levelRule=null;s.load(initial);
console.log(JSON.stringify({passed:cases.length,cases,options:p.options.length,lockedFinishes:p.finishes.length,rewards:p.rewards.map(r=>r.map(v=>v.name)),scope:'real geometry/state APIs and simulated DOM; no browser rendering'},null,2));
