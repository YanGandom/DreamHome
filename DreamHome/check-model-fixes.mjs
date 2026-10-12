import './check-geometry.mjs';
import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';
import {pickSceneSurface} from './scene-picking.js';
import {createGroundSelection} from './ground-selection.js';
const s=window.__winterScene.furnitureSystem,scene=window.__winterScene.scene;
const table=s.get('lobby-round-table'),top=table.root.children.find(o=>o.material?.userData.editablePaint);
top.updateWorldMatrix(true,false);
for(const [x,z] of [[.35,0],[-.35,0],[0,.35],[0,-.35]]){
  const target=new THREE.Vector3(4.13+x,1.74,.71+z);
  const ray=new THREE.Raycaster(target.clone().add(new THREE.Vector3(0,2,0)),new THREE.Vector3(0,-1,0));
  const hit=ray.intersectObject(top,false)[0];assert.ok(hit,'round tabletop must be closed');assert.ok(Math.abs(hit.point.y-target.y)<1e-5);
}
const rail=s.add('balcony-railing');s.move(rail.id,24,0,.14);s.rotationPreview(rail.id,30);
const marker=createGroundSelection(scene);
for(const width of [2,7,12]){
  s.resizeRailingPreview(rail.id,'right',width-rail.railingWidth,{position:rail.root.position.clone(),width:rail.railingWidth});
  scene.updateMatrixWorld(true);const span=rail.railingWidth-.132,count=rail.root.getObjectByName('RailingBalusters').count;
  const gapX=-span/2+span/(count-1)/2,target=rail.root.localToWorld(new THREE.Vector3(gapX,.4,0));
  const normal=new THREE.Vector3(0,0,1).transformDirection(rail.root.matrixWorld),ray=new THREE.Raycaster(target.clone().addScaledVector(normal,2),normal.clone().negate());
  assert.equal(ray.intersectObject(rail.root,true).length,0,'sample lies between balusters');
  assert.equal(pickSceneSurface(ray,{system:s})?.object.userData.furnitureId,rail.id);
  marker.update(rail,true);const fill=marker.root.getObjectByName('SelectionFootprint');assert.ok(Math.abs(fill.scale.x-width-.2)<1e-5);assert.ok(Math.abs(fill.scale.z-.34)<1e-5);assert.equal(marker.root.rotation.y,rail.root.rotation.y);
  const right=marker.root.getObjectByName('MoveArrow-right').getWorldPosition(new THREE.Vector3()),center=marker.root.position;assert.ok(Math.abs(right.z-center.z)<1e-5);assert.ok(right.x>center.x);
  const blocker=new THREE.Mesh(new THREE.BoxGeometry(1,1,.1),new THREE.MeshBasicMaterial());blocker.position.copy(target).addScaledVector(normal,1);blocker.quaternion.copy(rail.root.quaternion);scene.add(blocker);scene.updateMatrixWorld(true);
  assert.equal(pickSceneSurface(ray,{system:s,occluders:[blocker]})?.object,blocker,'closer surfaces still win');blocker.removeFromParent();
  rail.root.visible=false;assert.notEqual(pickSceneSurface(ray,{system:s})?.object.userData.furnitureId,rail.id);rail.root.visible=true;
}
console.log('PASS: closed round tabletop, railing gap picking, occlusion, visibility, rotated rectangular footprints at three widths');
