import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';
import {SURFACE_GAP} from './placement.js';
import {checkWallTextures} from './check-wall-textures.mjs';
import {checkWallMounting} from './check-wall-mounting.mjs';

export function checkArchitecture({system,scene,camera,editor,canvas,controls,$,winEvents,project,tap,findHit,startLibraryDrag,test}){
  editor.close();system.resetLayout();const initial=system.serialize(),a=system.architecture,p=system.placement,wall=system.get('wall-1'),art=system.get('wall-art-3');
  const reset=()=>{editor.close(false);p.setSurface('auto');system.load(initial);scene.updateMatrixWorld(true)};
  test('rugs clear raised floor patterns by 0.01m across their footprint and remain stable through saves',()=>{
    const rug=system.get('salon-rug'),floor=system.floorSystem.get('salon'),top=new THREE.Box3().setFromObject(floor.root).max.y;
    assert.ok(new THREE.Box3().setFromObject(rug.root).min.y-top>=SURFACE_GAP-1e-7);
    system.beginGesture();assert.equal(system.movePreview(rug.id,-4.2,1.9,1.0175),true);
    assert.ok(Math.abs(new THREE.Box3().setFromObject(rug.root).min.y-top-SURFACE_GAP)<1e-6);system.commitGesture();
    const saved=system.serialize();for(let i=0;i<4;i++){system.loadSaved(saved);assert.deepEqual(system.serialize(),saved)}
    const legacy=structuredClone(saved);delete legacy.surfaceGap;legacy.items.find(r=>r.id===rug.id).position[1]=1.025;
    const wallBefore=wall.root.position.clone(),artBefore=art.root.position.clone();system.loadSaved(legacy);assert.ok(rug.root.position.y>=top+SURFACE_GAP-1e-7);assert.ok(wall.root.position.equals(wallBefore));assert.ok(art.root.position.equals(artBefore));const migrated=system.serialize();system.loadSaved(migrated);assert.deepEqual(system.serialize(),migrated);reset();
  });
  test('floor, upper-floor and wall-top placements add clearance once and undo preserves exact heights',()=>{
    const r=system.get('plant-salon');
    for(const [x,z,y]of [[4,1,1.02],[-3.5,-3.7,3.9125],[4,4.78,a.bounds(system.get('wall-6')).max.y]]){
      const before=system.serialize();system.beginGesture();assert.equal(system.movePreview(r.id,x,z,y),true);const height=r.root.position.y;assert.ok(Math.abs(height-y-SURFACE_GAP)<1e-6);system.commitGesture();const after=system.serialize();system.undo();assert.deepEqual(system.serialize(),before);system.redo();assert.deepEqual(system.serialize(),after);assert.equal(r.root.position.y,height);
    }reset();
  });
  test('surface definitions distinguish outdoor ground, foundation, both stories and courtyard caps',()=>{
    assert.deepEqual(a.surfaces.map(s=>s.id),['auto','outdoor','foundation','floor-1','floor-2','wall-top']);
    const at=(id,x,z,y)=>{p.setSurface(id);return p.supportAt(x,z,y,'salon-chair-a')};
    assert.equal(at('outdoor',8.8,7.7,2).id,'outdoor');assert.equal(at('foundation',7.9,0,2).id,'foundation');
    const one=at('floor-1',-3.5,-3.7,10),two=at('floor-2',-3.5,-3.7,10);assert.equal(one.id,'floor-1');assert.equal(two.id,'floor-2');assert.ok(two.point.y-one.point.y>2.8);
    assert.equal(at('wall-top',4,4.78,10).id,'wall-top');assert.equal(at('floor-2',10,10,10),null);reset();
  });
  test('courtyard caps support items and moving or lengthening that wall carries the placed item',()=>{
    const r=system.get('plant-balcony-a'),w=system.get('wall-6'),b=a.bounds(w),y=b.max.y;
    assert.equal(system.movePreview(r.id,4,4.78,y),true);assert.equal(r.mount.wallId,w.id);assert.equal(r.mount.type,'top');
    assert.equal(system.movePreview(r.id,4,4.78,1.1),false);
    const before=r.root.position.clone(),wb=w.root.position.clone();system.beginGesture();system.movePreview(w.id,wb.x-.3,wb.z-.8);assert.ok(r.root.position.distanceTo(before.clone().add(new THREE.Vector3(-.3,0,-.8)))<1e-6);
    assert.equal(system.lengthPreview(w.id,24),false);system.cancelGesture();assert.ok(r.root.position.distanceTo(before)<1e-6);reset();
  });
  test('wall edits respect a fixed foundation and carry unscaled wall attachments',()=>{
    const f={...a.footprint},originalSize=new THREE.Box3().setFromObject(art.root).getSize(new THREE.Vector3()),local=structuredClone(art.mount),before=JSON.stringify(system.serialize());
    system.beginGesture();assert.equal(system.lengthPreview(wall.id,12),false);assert.deepEqual(a.footprint,f);assert.equal(system.movePreview(wall.id,wall.root.position.x-1,wall.root.position.z-2),false);
    system.lengthPreview(wall.id,6);system.movePreview(wall.id,-4,-2);assert.equal(system.rotationPreview(wall.id,25),true);assert.ok(art.root.position.distanceTo(wall.root.localToWorld(new THREE.Vector3(...local.local)))<1e-6);assert.deepEqual(art.root.scale.toArray(),[1,1,1]);assert.deepEqual(a.footprint,f);
    assert.ok(Math.abs(art.localBounds.getSize(new THREE.Vector3()).y-originalSize.y)<1e-6);system.commitGesture();const after=JSON.stringify(system.serialize());system.undo();assert.equal(JSON.stringify(system.serialize()),before);assert.deepEqual(a.footprint,f);system.redo();assert.equal(JSON.stringify(system.serialize()),after);
    const saved=system.serialize(),footprint={...a.footprint};system.load(initial);system.loadSaved(saved);assert.deepEqual(system.serialize(),saved);assert.deepEqual(a.footprint,footprint);reset();
  });
  test('rotated and resized walls use current body collisions rather than their original locations',()=>{
    const w=system.get('wall-4'),r=system.get('salon-chair-a');system.beginGesture();system.movePreview(w.id,4,0);system.rotationPreview(w.id,45);system.lengthPreview(w.id,4);
    const center=w.root.localToWorld(w.localBounds.getCenter(new THREE.Vector3()));assert.equal(p.valid(r,center.x,1.04,center.z),false);assert.equal(p.valid(r,7.83,1.04,-2.55),true);system.cancelGesture();reset();
  });
  test('wall materials and colors are independent, texture density follows length and history restores them',()=>{
    const other=system.get('wall-2'),before=other.paint[0].map,original=wall.paint[0].map;system.beginGesture();assert.equal(system.materialPreview(wall.id,'brick'),true);const map=wall.paint[0].map,repeat=map.repeat.x;system.lengthPreview(wall.id,6);assert.ok(map.repeat.x<repeat);system.colorPreview(wall.id,'#638b9c');assert.equal(other.paint[0].map,before);assert.equal(wall.paint[0].color.getHexString(),'638b9c');system.cancelGesture();assert.equal(wall.paint[0].map,original);assert.equal(wall.wallMaterial,null);reset();
  });
  checkWallTextures({system,test,reset});
  checkWallMounting({system,scene,test,reset});
  test('library wall decor drops select the interior face; exterior drops cancel without saving a copy',()=>{
    const cameraBefore=camera.position.clone(),targetBefore=controls.target.clone();
    const aim=(x)=>{camera.position.set(x,3.3,-2.55);controls.target.set(7.83,3.3,-2.55);controls.update();scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);return project(new THREE.Vector3(7.83,3.3,-2.55))};
    const before=system.serialize(),point=aim(4.5);startLibraryDrag(art.sourceId,point);winEvents.emit('pointerup',point);const copy=system.get(editor.selectedId);assert.ok(copy);assert.equal(copy.mount.wallId,'wall-4');assert.equal(copy.mount.side,'interior');assert.equal(copy.mount.faceSign,-1);editor.close();system.undo();assert.deepEqual(system.serialize(),before);
    const outside=aim(11);startLibraryDrag(art.sourceId,outside);winEvents.emit('pointerup',outside);assert.deepEqual(system.serialize(),before);assert.equal(editor.selectedId,null);reset();camera.position.copy(cameraBefore);controls.target.copy(targetBefore);controls.update();camera.updateMatrixWorld(true);
  });
  test('wall decoration movement changes height and tangent only and survives save/delete/restore',()=>{
    const before=art.root.position.clone();system.beginGesture();assert.equal(system.movePreview(art.id,before.x+.3,before.z,before.y+.25),true);assert.ok(Math.abs(art.root.position.y-before.y-.25)<1e-6);assert.ok(Math.abs(art.root.position.z-before.z)<1e-6);system.commitGesture();const moved=art.root.position.clone(),mount=structuredClone(art.mount);system.remove(art.id);assert.equal(art.root.visible,false);system.restore(art.id);assert.ok(art.root.position.equals(moved));assert.deepEqual(art.mount,mount);const saved=system.serialize();system.load(initial);system.loadSaved(saved);assert.ok(art.root.position.equals(moved));reset();
  });
  test('wall UI offers three scene strips instead of the length slider and preserves furniture controls',()=>{
    editor.select(wall.id);assert.equal($('object-length'),undefined);assert.equal($('wall-length'),undefined);assert.equal($('object-material').hidden,false);assert.equal($('object-delete').hidden,false);
    const handles=scene.getObjectByName('WallResizeHandles');assert.equal(handles.visible,true);assert.equal(handles.children.length,3);$('object-confirm').click();assert.equal(editor.selectedId,null);assert.equal(handles.visible,false);
    editor.select(wall.id);$('object-material').click();assert.equal($('wall-material-options').children.length,4);$('wall-material-options').children[2].click();assert.equal(wall.wallMaterial,'wood');winEvents.emit('keydown',{key:'Escape'});assert.equal(wall.wallMaterial,null);
    editor.select('salon-sofa');assert.equal(handles.visible,false);assert.equal($('object-material').hidden,true);reset();
  });
  test('library drag onto a courtyard cap commits a wall-bound item and undoes completely',()=>{
    p.setSurface('wall-top');const w=system.get('wall-6'),point=project(new THREE.Vector3(4,a.bounds(w).max.y,4.78)),before=system.serialize();
    startLibraryDrag('plant-salon',point);winEvents.emit('pointerup',point);const r=system.get(editor.selectedId);assert.ok(r);assert.equal(r.mount?.wallId,w.id);assert.equal(r.surface,'wall-top');assert.ok(Math.abs(r.root.position.y-a.bounds(w).max.y)<.04);editor.close();system.undo();assert.deepEqual(system.serialize(),before);reset();
  });
  test('wall attachments can transfer between perpendicular walls without losing the mounting link',()=>{
    const before=system.serialize(),target=system.get('wall-3');system.beginGesture();assert.equal(system.movePreview(art.id,-7.6,-2.2,3.1,false,target.id),true);assert.equal(art.mount.wallId,target.id);assert.ok(Math.abs(art.root.rotation.y-Math.PI/2)<1e-6);const mounted=art.root.position.clone();system.movePreview(target.id,target.root.position.x+.8,target.root.position.z);assert.ok(Math.abs(art.root.position.x-mounted.x-.8)<1e-6);system.cancelGesture();assert.deepEqual(system.serialize(),before);reset();
  });
  test('mounted-object drag uses the wall plane, keeps the camera still and cancels without drift',()=>{
    camera.position.set(-4.75,2.8,-1.7);controls.target.set(-4.75,2.4,-4.4);controls.update();scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    editor.select(art.id);const point=findHit(art.id),before=art.root.position.clone(),cam=camera.position.clone();canvas.emit('pointerdown',point);canvas.emit('pointermove',{...point,clientX:point.clientX+16,clientY:point.clientY-25});canvas.emit('pointerup',point);
    assert.ok(art.root.position.y>before.y+.01);assert.ok(Math.abs(art.root.position.z-before.z)<1e-5);assert.ok(camera.position.equals(cam));const marker=scene.getObjectByName('GroundSelection'),up=new THREE.Vector3(0,1,0).applyQuaternion(marker.quaternion);assert.ok(up.z>.99);
    winEvents.emit('keydown',{key:'Escape'});assert.ok(art.root.position.distanceTo(before)<1e-6);reset();
  });
  test('surfaces are automatic with no selector and wall resizing respects mounted widths',()=>{
    assert.equal($('placement-surface'),undefined);assert.equal(p.activeSurface,'auto');system.beginGesture();system.lengthPreview('wall-2',1);const r=system.get('wall-2');assert.ok(r.root.scale.x*r.localBounds.getSize(new THREE.Vector3()).x>=a.minimumLength(r.id)-1e-6);system.cancelGesture();reset();
  });
  test('three wall models drag from the catalog onto a component foundation and return through the same card',()=>{
    const cameraBefore=camera.position.clone(),targetBefore=controls.target.clone(),build=system.construction;
    for(const source of ['wall-1','wall-2','wall-5']){
      reset();const room=build.addRoom({x:14,z:0});assert.ok(room);camera.position.set(18,15,14);controls.target.set(14,1,0);controls.update();camera.updateMatrixWorld(true);scene.updateMatrixWorld(true);editor.setCategory('walls');
      const before=system.serialize(),point=project(new THREE.Vector3(14,1.02,0));startLibraryDrag(source,point);winEvents.emit('pointerup',point);
      const copy=system.get(editor.selectedId);assert.ok(copy);assert.equal(copy.sourceId,source);assert.ok(Math.abs(copy.root.position.x-14)<.02);assert.ok(Math.abs(copy.root.position.z)<.02);assert.ok(a.validWall(copy));editor.close();
      const placed=system.serialize();system.undo();assert.deepEqual(system.serialize(),before);system.redo();assert.deepEqual(system.serialize(),placed);
      editor.select(copy.id);$('object-delete').click();assert.equal(copy.root.visible,false);assert.equal($('library-list').children.find(c=>c.dataset.itemId===source).dataset.restoreId,copy.id);
      startLibraryDrag(source,point);winEvents.emit('pointerup',point);assert.equal(editor.selectedId,copy.id);assert.equal(copy.root.visible,true);editor.close();
    }
    reset();editor.setCategory('all');camera.position.copy(cameraBefore);controls.target.copy(targetBefore);controls.update();camera.updateMatrixWorld(true);
  });
}
