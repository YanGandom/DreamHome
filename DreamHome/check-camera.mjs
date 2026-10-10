// Exercise the actual scene loop and OrbitControls without browser/GPU automation.
import {stepSceneFrame} from './check-geometry.mjs';
import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';
const {camera,controls,views,goView,editor,furnitureSystem:system}=window.__winterScene;
const button=document.getElementById('camera-view-toggle'),label=document.getElementById('camera-view-label');
const settle=()=>{const now=performance.now();stepSceneFrame(now+1100);stepSceneFrame(now+1200)};
const same=(actual,expected)=>assert.ok(actual.distanceTo(new THREE.Vector3(...expected))<.0001);
const before=system.serialize();

// A user may pan/rotate/enable orbit before requesting a fixed view.
camera.position.set(10,14,17);controls.target.set(3,1,2);controls.update();controls.autoRotate=true;
button.onclick();settle();
assert.equal(controls.autoRotate,false);same(camera.position,views.top.p);same(controls.target,views.top.t);
assert.ok(camera.getWorldDirection(new THREE.Vector3()).dot(new THREE.Vector3(0,-1,0))>.999999);
assert.equal(label.textContent,'原始位置');assert.equal(button.attributes['aria-pressed'],'true');
button.onclick();settle();same(camera.position,views.overview.p);same(controls.target,views.overview.t);
assert.equal(label.textContent,'俯视');assert.equal(button.attributes['aria-pressed'],'false');
assert.deepEqual(system.serialize(),before);

// Rapid taps reverse the transition, and completed views do not drift later.
button.onclick();stepSceneFrame(performance.now()+250);button.onclick();settle();same(camera.position,views.overview.p);
const resting=camera.position.clone();for(let i=0;i<20;i++)stepSceneFrame(performance.now()+1300+i*16);
assert.ok(camera.position.distanceTo(resting)<.0001);
editor.dragging=true;button.onclick();assert.equal(label.textContent,'俯视');editor.dragging=false;

// Returning to the original view must also provide a way out of room cutaway.
const model=system.construction,id=model.addRoom({x:14,z:0});model.setRoof(id,'gable');
model.setView('1');editor.options.onBuildingView('1',model.room(id));settle();
const saved=system.serialize();button.onclick();settle();assert.equal(model.view,'1');
button.onclick();settle();assert.equal(model.view,'outside');assert.equal(model.getModel(id+'-roof').children[0].layers.mask&1,1);
assert.deepEqual(system.serialize(),saved);system.load(before);

// A true overhead view still contains the original site on portrait and landscape screens.
for(const [width,height]of [[390,420],[844,230],[1600,900]]){
  const mount=document.querySelector('#scene');mount.clientWidth=width;mount.clientHeight=height;
  editor.options.onResize();goView('top',true);camera.updateMatrixWorld(true);
  for(const x of [-11,11])for(const z of [-8,10]){const p=new THREE.Vector3(x,0,z).project(camera);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1&&Math.abs(p.z)<1,`${width}x${height}: site should fit`)}
}
goView('overview',true);
console.log('4 camera checks passed: exact return, rapid taps/inertia, room exit without data changes, mobile framing');
