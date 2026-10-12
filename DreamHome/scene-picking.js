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
  const hit=raycaster.intersectObjects([...meshes],false).find(hit=>{
    const material=Array.isArray(hit.object.material)?hit.object.material[hit.face.materialIndex]:hit.object.material;
    if(!material||!material.visible||material.transparent&&material.opacity<=0)return false;
    const {furnitureId,buildId,floorId}=hit.object.userData;
    return furnitureId||buildId||floorId||!material.transparent||material.opacity>.65;
  })||null;
  return hit?system.scatter?.resolveHit(hit)||hit:null;
}
