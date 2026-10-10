import * as THREE from './vendor/three.module.js';

export const SURFACES=[{id:'auto',name:'自动识别表面'},{id:'outdoor',name:'室外 · 地面'},{id:'foundation',name:'室外 · 地基'},{id:'floor-1',name:'室内 · 一楼'},{id:'floor-2',name:'室内 · 二楼'},{id:'wall-top',name:'院墙 · 顶部'}];

function wallStyles(){
  return ['plaster','brick','wood','wallpaper'].map((id,i)=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');
    c.fillStyle=['#ede6d8','#d4ab96','#c7ab82','#dfcc9c'][i];c.fillRect(0,0,256,256);
    c.strokeStyle=['#d9d0c044','#eee6d6','#806744','#f4e3ba'][i];c.lineWidth=i===1?4:2;
    if(i===0){for(let n=0;n<800;n++){c.fillStyle=n%2?'#a69c8f18':'#ffffff44';c.fillRect((n*73)%256,(n*43)%256,2,1)}}
    if(i===1){for(let y=0;y<=256;y+=32){c.beginPath();c.moveTo(0,y);c.lineTo(256,y);c.stroke();for(let x=(y%64?32:0);x<=256;x+=64){c.beginPath();c.moveTo(x,y);c.lineTo(x,y+32);c.stroke()}}}
    if(i===2){for(let x=0;x<=256;x+=32){c.beginPath();c.moveTo(x,0);c.lineTo(x,256);c.stroke();for(let j=1;j<5;j++){c.strokeStyle='#80674440';c.beginPath();c.moveTo(x+j*5,0);c.bezierCurveTo(x+j*5+5,70,x+j*5-3,150,x+j*5,256);c.stroke()}}}
    if(i===3){for(let y=0;y<256;y+=64)for(let x=0;x<256;x+=64){c.beginPath();c.moveTo(x+32,y+3);c.bezierCurveTo(x+62,y+32,x+32,y+32,x+32,y+61);c.bezierCurveTo(x+2,y+32,x+32,y+32,x+32,y+3);c.stroke()}}
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    return{id,name:['细腻灰泥','砖墙','木饰面','花纹墙纸'][i],texture,preview:canvas.toDataURL?.('image/png')||''};
  });
}

// The authored foundation stays fixed. Wall edits are constrained to its rooms.
export function createArchitectureSystem({system,foundationMeshes,outdoorMeshes,floorSystem,mergeGeometries}){
  const styles=wallStyles(),originalMaps=new WeakMap(),materialMaps=new Map();
  const walls=()=>[...system.all().filter(r=>r.kind==='wall'&&r.root.visible),...(system.construction?.wallRecords()||[])];
  const bounds=r=>{r.root.updateWorldMatrix(true,true);return new THREE.Box3().setFromObject(r.root)};
  const envelope=()=>{const b=new THREE.Box3();for(const r of walls())b.union(bounds(r));return b};
  const originalEnvelope=envelope(),originalCenter=originalEnvelope.getCenter(new THREE.Vector3()),originalSize=originalEnvelope.getSize(new THREE.Vector3());
  const foundations=foundationMeshes.map(mesh=>({mesh,position:mesh.position.clone(),scale:mesh.scale.clone(),bounds:new THREE.Box3().setFromObject(mesh)}));
  const ground=new THREE.Group();ground.name='OutdoorGround';foundationMeshes[0].parent.add(ground);ground.userData.surfaceId='outdoor';
  const batches=new Map();for(const mesh of outdoorMeshes){mesh.updateWorldMatrix(true,false);const g=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);const geo=g.index?g.toNonIndexed():g;if(!batches.has(mesh.material))batches.set(mesh.material,[]);batches.get(mesh.material).push(geo);mesh.removeFromParent()}
  for(const [material,geometries]of batches){const mesh=new THREE.Mesh(mergeGeometries(geometries,false),material);mesh.receiveShadow=true;mesh.castShadow=true;mesh.userData.surfaceId='outdoor';ground.add(mesh);geometries.forEach(g=>g.dispose())}
  let footprint={width:16,depth:10,x:0,z:0};
  const axis=r=>r.lengthAxis||'x';
  const faceAngle=r=>r.root.rotation.y+(axis(r)==='z'?Math.PI/2:0);
  const normal=r=>new THREE.Vector3(Math.sin(faceAngle(r)),0,Math.cos(faceAngle(r)));
  function bind(r,wallId,type='face'){
    const wall=system.get(wallId);if(wall?.kind!=='wall')return;
    wall.root.updateMatrixWorld(true);r.mount={wallId,type,local:wall.root.worldToLocal(r.root.position.clone()).toArray(),rotation:r.root.rotation.y-wall.root.rotation.y,...(type==='top'?{topGap:r.root.position.y-bounds(wall).max.y}:{})};
  }
  function bindSupport(r){
    if(r.kind==='wall'||r.kind==='mounted')return;
    const wall=walls().find(w=>{if(!w.wallTop)return false;const b=bounds(w),p=w.root.worldToLocal(r.root.position.clone());return Math.abs(r.root.position.y-b.max.y)<.12&&p.x>=w.localBounds.min.x-.02&&p.x<=w.localBounds.max.x+.02&&p.z>=w.localBounds.min.z-.02&&p.z<=w.localBounds.max.z+.02});
    if(wall)bind(r,wall.id,'top');else r.mount=null;
  }
  function moveMounted(r,point,wallId=r.mount?.wallId||r.mountWallId){
    const wall=system.get(wallId);if(wall?.kind!=='wall'||!wall.root.visible)return false;
    wall.root.updateMatrixWorld(true);const p=wall.root.worldToLocal(point.clone()),b=wall.localBounds,along=axis(wall),depth=along==='x'?'z':'x',size=r.localBounds.getSize(new THREE.Vector3());
    const source=system.get(r.mountWallId)||wall,modelWidth=source.lengthAxis==='z'?size.z:size.x,half=modelWidth/2/wall.root.scale[along],min=b.min[along]+half,max=b.max[along]-half;
    if(max<min||size.y>(b.max.y-b.min.y)*wall.root.scale.y)return false;
    p[along]=THREE.MathUtils.clamp(p[along],min,max);p.y=THREE.MathUtils.clamp(p.y,b.min.y,b.max.y-size.y/wall.root.scale.y);
    // Preserve the model's authored wall stand-off; never push it inside the wall.
    const sourceWall=system.templates.get(r.mountWallId),template=system.templates.get(r.sourceId);
    const initialDepth=source.lengthAxis==='z'?size.x:size.z;
    const sourceDepth=source.lengthAxis==='z'?'x':'z',standOff=template.mount?template.mount.local[sourceDepth==='x'?0:2]-sourceWall.localBounds.max[sourceDepth]:initialDepth/2+.015;
    p[depth]=b.max[depth]+standOff;
    r.root.position.copy(wall.root.localToWorld(p));
    if(wallId!==r.mount?.wallId)r.root.rotation.y=faceAngle(wall)-(sourceWall?.lengthAxis==='z'?Math.PI/2:0);
    r.root.updateMatrixWorld(true);bind(r,wallId);return true;
  }
  function sync(){
    for(const wall of walls())if(wall.wallMaterial)setMaterial(wall,wall.wallMaterial);
    for(const r of system.all())if(r.mount){const wall=system.get(r.mount.wallId);if(wall?.root.visible){const p=new THREE.Vector3(...r.mount.local);if(r.mount.type==='face'){const size=r.localBounds.getSize(new THREE.Vector3()),width=r.mountWallId==='wall-3'?size.z:size.x,along=axis(wall),half=width/2/wall.root.scale[along];p[along]=THREE.MathUtils.clamp(p[along],wall.localBounds.min[along]+half,wall.localBounds.max[along]-half);p.y=THREE.MathUtils.clamp(p.y,wall.localBounds.min.y,wall.localBounds.max.y-size.y/wall.root.scale.y)}else if(r.mount.type==='top'){const top=bounds(wall).max.y;if(!Number.isFinite(r.mount.topGap))r.mount.topGap=r.root.position.y-top;p.y=(top+r.mount.topGap-wall.root.position.y)/wall.root.scale.y}wall.root.localToWorld(p);if(Math.abs(p.y-r.root.position.y)<1e-7)p.y=r.root.position.y;r.root.position.copy(p);r.root.rotation.y=wall.root.rotation.y+r.mount.rotation;r.root.updateMatrixWorld(true)}}
  }
  function setMaterial(r,id){
    if(id!==null&&!styles.some(s=>s.id===id))return false;
    for(const material of r.paint){
      if(!originalMaps.has(material))originalMaps.set(material,{map:material.map,roughness:material.roughness});
      if(id===null){Object.assign(material,originalMaps.get(material))}
      else{const key=r.id+':'+id;let map=materialMaps.get(key);if(!map){map=styles.find(s=>s.id===id).texture.clone();map.needsUpdate=true;materialMaps.set(key,map)}const size=r.localBounds.getSize(new THREE.Vector3());map.repeat.set(size[axis(r)]*r.root.scale[axis(r)]/1.8,size.y*r.root.scale.y/1.8);material.map=map;material.roughness=id==='wood'?.7:.88}
      material.needsUpdate=true;
    }r.wallMaterial=id;return true;
  }
  for(const r of system.all()){if(r.kind==='mounted')bind(r,r.mountWallId);else bindSupport(r)}
  for(const r of system.all())if(r.mount)system.templates.get(r.sourceId).mount=structuredClone(r.mount);
  sync();
  function minimumLength(wallId){return Math.max(1,...system.all().filter(r=>r.kind==='mounted'&&r.mount?.wallId===wallId).map(r=>r.localBounds.getSize(new THREE.Vector3())[r.mountWallId==='wall-3'?'z':'x']+.2))}
  function minimumHeight(wallId){return Math.max(.6,...system.all().filter(r=>r.kind==='mounted'&&r.mount?.wallId===wallId).map(r=>r.localBounds.getSize(new THREE.Vector3()).y+.2))}
  function validWall(r){
    if(r.dynamic)return system.construction.validWall(r.data);
    r.root.updateMatrixWorld(true);const b=(r.collisionBounds||r.localBounds).clone().applyMatrix4(r.root.matrixWorld);
    const left=['wall-1','wall-3'].includes(r.id),right=['wall-2','wall-4'].includes(r.id);
    const minX=right?-.03:-8.15,maxX=left?.03:8.15;
    return b.min.x>=minX-.001&&b.max.x<=maxX+.001&&b.min.z>=-5.15&&b.max.z<=5.15;
  }
  return{styles,surfaces:SURFACES,walls,bounds,normal,faceAngle,bind,bindSupport,moveMounted,sync,setMaterial,minimumLength,minimumHeight,validWall,get footprint(){return footprint}};
}
