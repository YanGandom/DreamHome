// CPU regression checks against the complete real scene. DOM and GPU are mocked;
// these checks exercise model state, real raycasting, and editor event handlers.
import './check-geometry.mjs';
import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';
import {SURFACE_GAP} from './placement.js';

const {scene,camera,renderer,controls,furnitureSystem:system,goView,snow}=window.__winterScene;
const initial=system.serialize(),sofa=system.get('salon-sofa'),other=system.get('salon-chair-a');
const cases=[];
function test(name,fn){fn();cases.push(name)}
const snapshot=()=>JSON.stringify(system.serialize());
test('69 assemblies have independent paint materials and finite anchors',()=>{
  assert.equal(system.all().length,69);
  for(const r of system.all()){assert.ok(r.paint.length,r.id);assert.ok(r.root.children.length);assert.ok(r.initial.toArray().every(Number.isFinite));for(const m of r.paint)assert.notEqual(m,system.templates.get(r.sourceId).root.children.find(o=>o.material.userData.editablePaint)?.material)}
});
test('color changes only the selected upholstery, preserving accents and other furniture',()=>{
  const original=other.paint.map(m=>m.color.getHexString()),accents=sofa.root.children.filter(o=>!o.material.userData.editablePaint).map(o=>o.material.color.getHexString());
  system.setColor(sofa.id,'#1122aa');assert.ok(sofa.paint.every(m=>m.color.getHexString()==='1122aa'));
  assert.deepEqual(other.paint.map(m=>m.color.getHexString()),original);assert.deepEqual(sofa.root.children.filter(o=>!o.material.userData.editablePaint).map(o=>o.material.color.getHexString()),accents);
  system.undo();assert.equal(sofa.color,null);system.redo();assert.equal(sofa.color,'#1122aa');
});
test('drag previews commit as one undo, cancel restores the starting layout',()=>{
  const before=snapshot(),history=system.historyLength;system.beginGesture();for(let i=1;i<=10;i++)system.movePreview(sofa.id,-5+i*.04,1.5+i*.03);system.commitGesture();assert.equal(system.historyLength,history+1);const after=snapshot();assert.notEqual(after,before);system.undo();assert.equal(snapshot(),before);system.redo();assert.equal(snapshot(),after);
  system.beginGesture();system.movePreview(sofa.id,5,-2);system.cancelGesture();assert.equal(snapshot(),after);
});
test('table accessories move and rotate with the table as one assembly',()=>{
  const table=system.get('hearth-coffee'),children=table.root.children,local=children.map(o=>o.position.toArray());assert.ok(children.length>=5);
  const child=children[0],before=child.localToWorld(new THREE.Vector3());system.move(table.id,table.root.position.x-.4,table.root.position.z-.3);const after=child.localToWorld(new THREE.Vector3());assert.ok(after.distanceTo(before)>.4);system.rotate(table.id,90);assert.ok(Math.abs(table.root.rotation.y-Math.PI/2)<1e-9);assert.deepEqual(children.map(o=>o.position.toArray()),local);
});
test('delete, restore, undo and redo retain color and transform',()=>{
  const before=snapshot();system.remove(sofa.id);assert.equal(sofa.root.visible,false);assert.ok(system.all().includes(sofa));system.undo();assert.equal(snapshot(),before);system.redo();assert.equal(sofa.root.visible,false);system.restore(sofa.id);assert.equal(snapshot(),before);
});
test('copies have distinct IDs and colors, and addition is undoable',()=>{
  const a=system.add(sofa.id),b=system.add(sofa.id);assert.notEqual(a.id,b.id);assert.notEqual(a.paint[0],sofa.paint[0]);assert.notEqual(a.paint[0],b.paint[0]);assert.equal(a.color,null);assert.equal(a.sourceId,sofa.id);
  system.setColor(a.id,'#aabbcc');assert.equal(sofa.color,'#1122aa');assert.equal(b.color,null);system.undo();system.undo();assert.equal(system.get(b.id),null);system.redo();assert.ok(system.get(b.id));system.remove(a.id);
});
test('serialization round trip preserves changed, copied and stored items',()=>{
  const saved=system.serialize(),before=snapshot();system.resetLayout();assert.equal(system.all().length,69);assert.ok(system.load(saved));assert.equal(snapshot(),before);assert.equal(system.load({version:99,items:[]}),false);
});
test('objects cross original zones, land on real surfaces and retain height in history/storage',()=>{
  const r=system.get('salon-chair-a');system.move(r.id,8.6,7.8);assert.equal(r.root.position.x,8.6);assert.ok(r.root.position.y<.7);const outdoors=snapshot();
  system.move(r.id,-3.5,-3.7,3.9125);assert.equal(r.root.position.y,3.9125+SURFACE_GAP);const balcony=system.serialize();system.undo();assert.equal(snapshot(),outdoors);system.redo();assert.deepEqual(system.serialize(),balcony);system.load(balcony);assert.equal(r.root.position.y,3.9125+SURFACE_GAP);
  system.move(r.id,11,4);assert.equal(r.root.position.x,11);assert.equal(r.root.position.z,4);
});
test('walls reject footprints and rotations but other furniture is not a collision obstacle',()=>{
  const r=system.get('salon-chair-a');system.move(r.id,0,0,1.04);const p=r.root.position.clone();
  for(const [x,z]of [[0,-4.7],[-7.83,-2.7],[7.83,-2.55],[-6.1,4.78],[2.35,4.78],[-7.82,2.25]]){assert.equal(system.movePreview(r.id,x,z,1.1),false);assert.ok(r.root.position.equals(p))}
  assert.equal(system.movePreview(r.id,sofa.root.position.x,sofa.root.position.z,sofa.root.position.y),true);
  system.move(r.id,0,0,1.04);
  const floor=system.placement.heightAt(5,2,1.1,r.id),balcony=system.placement.heightAt(-3.5,-3.7,4,r.id),stair=system.placement.heightAt(-1.2,.05,3,r.id);
  assert.ok(floor>1&&floor<1.05);assert.ok(balcony>3.9&&balcony<3.93);assert.ok(stair>1.5&&stair<3);
  system.move(sofa.id,0,3.7,1.04);const before=sofa.root.rotation.y;assert.equal(system.rotationPreview(sofa.id,90),false);assert.equal(sofa.root.rotation.y,before);
});
test('cancelled catalog previews leave no visible or hidden scene copies',()=>{
  const before=snapshot(),roots=scene.children.length;
  for(let i=0;i<4;i++){const r=system.beginPlacement(sofa.id,'catalog');system.movePreview(r.id,0,-4.7,1,true);assert.equal(r.root.userData.placementInvalid,true);system.cancelPlacement(r.id,true)}
  assert.equal(snapshot(),before);assert.equal(scene.children.length,roots);assert.equal(system.gesturing,false);
});
test('snow particles are enlarged',()=>{assert.equal(snow.material.size,.13);assert.equal(snow.material.opacity,.88)});
test('night mode reaches editable lamps and newly added lamp copies',()=>{
  const lamp=system.get('salon-lamp-a'),glow=lamp.root.children.find(o=>o.material.emissive.getHex()!==0).material;
  document.querySelector('#night').onclick();assert.equal(glow.emissiveIntensity,2.1);const copy=system.add(lamp.id),copyGlow=copy.root.children.find(o=>o.material.userData.sourceMaterialId===glow.userData.sourceMaterialId).material;assert.equal(copyGlow.emissiveIntensity,2.1);
  document.querySelector('#night').onclick();assert.equal(glow.emissiveIntensity,1.15);assert.equal(copyGlow.emissiveIntensity,1.15);
});
system.resetLayout();assert.deepEqual(system.serialize(),initial);
const outdoor=system.all().filter(r=>r.id.startsWith('garden-'));
test('all 12 outdoor assemblies include their snow and decorations, with independent editing',()=>{
  assert.equal(outdoor.length,12);
  const seenCategories=new Set();
  for(const r of outdoor){
    seenCategories.add(r.category);assert.ok(system.templates.has(r.id));assert.ok(r.root.children.some(o=>o.isMesh&&o.material.userData.baseColor==='#f5fbff'),r.id+' snow');
    const accents=r.root.children.filter(o=>o.isMesh&&!o.material.userData.editablePaint).map(o=>[o,o.material.color.getHexString(),o.position.toArray()]);
    system.beginGesture();assert.equal(system.movePreview(r.id,10,8,.14),true);assert.equal(system.rotationPreview(r.id,80),true);system.colorPreview(r.id,'#638b9c');
    assert.ok(r.paint.every(m=>m.color.getHexString()==='638b9c'));
    for(const [mesh,color,position]of accents){assert.equal(mesh.material.color.getHexString(),color);assert.deepEqual(mesh.position.toArray(),position);assert.equal(mesh.parent,r.root)}
    system.cancelGesture();assert.deepEqual(system.serialize(),initial);
  }
  assert.deepEqual([...seenCategories].sort(),['decor','lighting','plants','seating']);
});
test('streetlight light sources follow their models, hide with storage and clone independently',()=>{
  const r=system.get('garden-streetlamp-left'),light=r.root.children.find(o=>o.isPointLight),local=light.position.clone(),world=light.getWorldPosition(new THREE.Vector3());
  assert.ok(light);assert.ok(Math.abs(world.x+1.44)<1e-6&&Math.abs(world.z-6.73)<1e-6);assert.ok(world.y>=2.4&&world.y<2.9);
  system.beginGesture();system.movePreview(r.id,10,8,.14);system.rotationPreview(r.id,90);assert.ok(light.position.equals(local));assert.ok(light.getWorldPosition(new THREE.Vector3()).distanceTo(r.root.localToWorld(local.clone()))<1e-6);system.cancelGesture();
  system.remove(r.id);const visibleLights=[];scene.traverseVisible(o=>{if(o.isPointLight)visibleLights.push(o)});assert.ok(!visibleLights.includes(light));system.undo();assert.equal(r.root.visible,true);
  const copy=system.beginPlacement(r.id,'catalog'),copyLight=copy.root.children.find(o=>o.isPointLight);assert.notEqual(light,copyLight);assert.equal(copyLight.userData.furnitureId,copy.id);assert.equal(copyLight.parent,copy.root);system.cancelPlacement(copy.id,true);
  assert.deepEqual(system.serialize(),initial);
});
test('night/day lighting reaches existing, copied and restored streetlights',()=>{
  const r=system.get('garden-streetlamp-right');document.querySelector('#night').onclick();
  const copy=system.beginPlacement(r.id,'catalog'),light=copy.root.children.find(o=>o.isPointLight),originalLight=r.root.children.find(o=>o.isPointLight);assert.equal(light.intensity,19);assert.equal(originalLight.intensity,19);
  document.querySelector('#night').onclick();assert.equal(light.intensity,8);assert.equal(originalLight.intensity,8);system.cancelPlacement(copy.id,true);
});
test('legacy saved layouts gain new outdoor originals without losing edits, copies or stored items',()=>{
  const legacy={version:1,items:structuredClone(initial.items.filter(item=>!item.id.startsWith('garden-')||item.id==='garden-bench'))};
  const edited=legacy.items.find(item=>item.id==='salon-sofa');edited.position=[3,1.1,2];edited.rotation=.7;edited.color='#963d43';edited.visible=false;
  legacy.items.push({...structuredClone(edited),id:'copy-legacy-check',visible:true});
  assert.equal(legacy.items.length,59);assert.ok(system.loadSaved(legacy));assert.equal(system.all().length,70);
  const loaded=system.serialize();assert.deepEqual(loaded.items.find(item=>item.id===edited.id),edited);assert.ok(system.get('copy-legacy-check'));
  for(const r of outdoor){assert.ok(system.get(r.id));assert.equal(system.get(r.id).root.visible,true)}
  assert.ok(system.loadSaved(loaded));assert.deepEqual(system.serialize(),loaded);
  system.load(initial);assert.deepEqual(system.serialize(),initial);
});
export{cases};
