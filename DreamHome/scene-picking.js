import * as THREE from './vendor/three.module.js';

// All selection controllers use the same frontmost rendered surface. Keeping
// separate furniture/building raycasts lets an earlier event listener pick
// through a closer object, even though each individual list is distance-sorted.
export function pickSceneSurface(raycaster,{system,occluders=[]}){
  const roots=[...system.all().map(r=>r.root),...(system.floorSystem?.all()||[]).map(r=>r.root),...occluders];
  if(system.construction)roots.push(system.construction.root,system.construction.ground.root);
  if(system.scatter)roots.push(system.scatter.root);
  const meshes=new Set();
  for(const root of roots){
    let visible=true;for(let o=root;o;o=o.parent)if(!o.visible){visible=false;break}
    if(visible)root.traverseVisible(o=>{if(o.isMesh&&!o.userData.editorHelper)meshes.add(o)});
  }
  // Raycaster checks layers and geometry, but does not check visibility itself.
  const hits=raycaster.intersectObjects([...meshes],false).filter(hit=>{
    const material=Array.isArray(hit.object.material)?hit.object.material[hit.face.materialIndex]:hit.object.material;
    if(!material||!material.visible||material.transparent&&material.opacity<=0)return false;
    const {furnitureId,buildId,floorId}=hit.object.userData;
    return furnitureId||buildId||floorId||!material.transparent||material.opacity>.65;
  });
  // A railing's gaps belong to the same editable panel. Intersect its local
  // volume so rotation and length changes keep an accurate, narrow hit area.
  for(const record of system.all()){
    if(!record.railing)continue;
    let visible=true;for(let o=record.root;o;o=o.parent)if(!o.visible){visible=false;break}
    if(!visible)continue;
    record.root.updateWorldMatrix(true,false);
    const localRay=raycaster.ray.clone().applyMatrix4(record.root.matrixWorld.clone().invert());
    const localPoint=localRay.intersectBox(record.localBounds,new THREE.Vector3());
    if(!localPoint)continue;
    const point=localPoint.applyMatrix4(record.root.matrixWorld),distance=point.distanceTo(raycaster.ray.origin);
    if(distance>=raycaster.near&&distance<=raycaster.far)hits.push({distance,point,object:record.root});
  }
  const hit=hits.sort((a,b)=>a.distance-b.distance)[0]||null;
  return hit?system.scatter?.resolveHit(hit)||hit:null;
}
