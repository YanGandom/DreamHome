import './check-geometry.mjs';
import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';
import {WOOD_FINISHES} from './railing-system.js';
const s=window.__winterScene.furnitureSystem,initial=s.serialize(),cases=[];
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
const test=(name,fn)=>{s.load(initial);fn();cases.push(name)};
test('rail width grows post count without scaling posts and fixes the opposite edge after rotation',()=>{
  const r=s.add('balcony-railing');s.move(r.id,24,0,.14);s.rotationPreview(r.id,30);const baseline={position:r.root.position.clone(),width:r.railingWidth},posts=r.root.getObjectByName('RailingBalusters'),count=posts.count,shape=Array.from(posts.geometry.attributes.position.array),fixed=r.root.localToWorld(new THREE.Vector3(-r.railingWidth/2,0,0));
  assert.ok(s.resizeRailingPreview(r.id,'right',2,baseline));near(r.railingWidth,Math.round((baseline.width+2)*20)/20);assert.ok(r.root.getObjectByName('RailingBalusters').count>count);assert.deepEqual(Array.from(r.root.getObjectByName('RailingBalusters').geometry.attributes.position.array),shape);assert.ok(fixed.distanceTo(r.root.localToWorld(new THREE.Vector3(-r.railingWidth/2,0,0)))<1e-5);assert.deepEqual(r.root.scale.toArray(),[1,1,1]);
  s.resizeRailingPreview(r.id,'left',100,{position:r.root.position.clone(),width:r.railingWidth});near(r.railingWidth,1);assert.equal(s.resizeRailingPreview(r.id,'top',1,baseline),false);
});
test('all stair sets use three matching rail, body and tread palettes without recoloring other objects',()=>{
  const other=s.get('salon-sofa').paint[0].color.getHexString();assert.equal(WOOD_FINISHES.length,3);
  for(const id of ['balcony-railing','stair-left','stair-right','stair-entrance'])for(const f of WOOD_FINISHES){s.colorPreview(id,f.color);const r=s.get(id);assert.equal(r.color,f.color);r.root.traverse(o=>{if(o.isMesh){const role=o.material.userData.woodRole||'rail';assert.equal('#'+o.material.color.getHexString(),role==='body'?f.body:role==='tread'?f.tread:f.color)}})}
  assert.equal(s.get('salon-sofa').paint[0].color.getHexString(),other);const saved=s.serialize();s.loadSaved(saved);assert.deepEqual(s.serialize(),saved);
});
test('rail dimensions survive cancel, delete restore, copy and undo without changing the library model',()=>{
  const r=s.add('balcony-railing');s.move(r.id,24,0,.14);const before=s.serialize(),template=s.templates.get('balcony-railing').railingWidth;s.beginGesture();s.resizeRailingPreview(r.id,'right',1,{position:r.root.position.clone(),width:r.railingWidth});s.colorPreview(r.id,WOOD_FINISHES[2].color);s.commitGesture();const after=s.serialize();s.undo();assert.deepEqual(s.serialize(),before);s.redo();assert.deepEqual(s.serialize(),after);s.loadSaved(after);assert.deepEqual(s.serialize(),after);
  s.beginGesture();s.resizeRailingPreview(r.id,'left',1,{position:r.root.position.clone(),width:r.railingWidth});s.cancelGesture();assert.deepEqual(s.serialize(),after);s.remove(r.id);s.restore(r.id);near(r.railingWidth,after.items.find(i=>i.id===r.id).railingWidth);near(s.templates.get('balcony-railing').railingWidth,template);const copy=s.add('balcony-railing');near(copy.railingWidth,template);assert.notEqual(copy.root.children[0].geometry,r.root.children[0].geometry);
  const legacy=structuredClone(after);for(const i of legacy.items)delete i.railingWidth;s.loadSaved(legacy);near(s.get(r.id).railingWidth,template);
});
s.load(initial);console.log(JSON.stringify({passed:cases.length,cases},null,2));
