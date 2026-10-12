import * as THREE from './vendor/three.module.js';
import {createWallMounting} from './wall-mounting.js';
import {createWallStacking} from './wall-stacking.js';

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
  const styles=wallStyles(),originalMaps=new WeakMap(),materialMaps=new Map(),wallUV=new WeakMap();
  const walls=()=>[...system.all().filter(r=>r.kind==='wall'&&r.root.visible),...(system.construction?.wallRecords()||[])];
  const bounds=r=>{r.root.updateWorldMatrix(true,true);return new THREE.Box3().setFromObject(r.root)};
  const stacking=createWallStacking({system,walls,bounds});
  const envelope=()=>{const b=new THREE.Box3();for(const r of walls())b.union(bounds(r));return b};
  const originalEnvelope=envelope(),originalCenter=originalEnvelope.getCenter(new THREE.Vector3()),originalSize=originalEnvelope.getSize(new THREE.Vector3());
  const foundations=foundationMeshes.map(mesh=>({mesh,position:mesh.position.clone(),scale:mesh.scale.clone(),bounds:new THREE.Box3().setFromObject(mesh)}));
  const ground=new THREE.Group();ground.name='OutdoorGround';foundationMeshes[0].parent.add(ground);ground.userData.surfaceId='outdoor';
  const batches=new Map();for(const mesh of outdoorMeshes){mesh.updateWorldMatrix(true,false);const g=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);const geo=g.index?g.toNonIndexed():g;if(!batches.has(mesh.material))batches.set(mesh.material,[]);batches.get(mesh.material).push(geo);mesh.removeFromParent()}
  for(const [material,geometries]of batches){const mesh=new THREE.Mesh(mergeGeometries(geometries,false),material);mesh.receiveShadow=true;mesh.castShadow=true;mesh.userData.surfaceId='outdoor';ground.add(mesh);geometries.forEach(g=>g.dispose())}
  let footprint={width:16,depth:10,x:0,z:0};
  const axis=r=>r.lengthAxis||'x';
  const mounting=createWallMounting(system),faceAngle=mounting.angle,normal=mounting.normal;
  function bind(r,wallId,type='face'){
    const wall=system.get(wallId);if(wall?.kind!=='wall')return;
    if(type==='face')return mounting.move(r,r.root.position,wallId,r.mount?.faceSign);
    wall.root.updateMatrixWorld(true);r.mount={wallId,type,local:wall.root.worldToLocal(r.root.position.clone()).toArray(),rotation:r.root.rotation.y-wall.root.rotation.y,...(type==='top'?{topGap:r.root.position.y-bounds(wall).max.y}:{})};
  }
  function bindSupport(r){
    if(r.kind==='wall'||r.kind==='mounted')return;
    const wall=walls().find(w=>{if(!w.wallTop)return false;const b=bounds(w),p=w.root.worldToLocal(r.root.position.clone());return Math.abs(r.root.position.y-b.max.y)<.12&&p.x>=w.localBounds.min.x-.02&&p.x<=w.localBounds.max.x+.02&&p.z>=w.localBounds.min.z-.02&&p.z<=w.localBounds.max.z+.02});
    if(wall)bind(r,wall.id,'top');else r.mount=null;
  }
  const moveMounted=mounting.move;
  function sync(){
    stacking.sync();
    for(const wall of walls())setMaterial(wall,wall.wallMaterial||null);
    for(const r of system.all()){
      if(r.kind==='wall')continue;
      if(r.kind==='mounted'&&!r.mount)bind(r,r.mountWallId);
      if(!r.mount)continue;const wall=system.get(r.mount.wallId);if(!wall?.root.visible)continue;
      if(r.mount.type==='face'){mounting.sync(r,wall);continue}
      const p=new THREE.Vector3(...r.mount.local);
      if(r.mount.type==='top'){const top=bounds(wall).max.y;if(!Number.isFinite(r.mount.topGap))r.mount.topGap=r.root.position.y-top;p.y=(top+r.mount.topGap-wall.root.position.y)/wall.root.scale.y}
      wall.root.localToWorld(p);if(Math.abs(p.y-r.root.position.y)<1e-7)p.y=r.root.position.y;r.root.position.copy(p);r.root.rotation.y=wall.root.rotation.y+r.mount.rotation;r.root.updateMatrixWorld(true);
    }
  }
  function updateWallUV(r,id){
    const scale=r.root.scale,size=r.localBounds.getSize(new THREE.Vector3()),signature=[id||'original',scale.x,scale.y,scale.z].join(':');
    r.root.updateWorldMatrix(true,true);
    const inverse=r.root.matrixWorld.clone().invert();
    r.root.traverse(mesh=>{
      if(!mesh.isMesh||!r.paint.includes(mesh.material)||!mesh.material.map)return;
      let cached=wallUV.get(mesh);
      if(!cached){
        // Authored wall geometry is also used by library templates. UV edits
        // belong only to this wall; dynamic construction already owns its boxes.
        if(!r.dynamic)mesh.geometry=mesh.geometry.clone();
        const geometry=mesh.geometry,positions=geometry.attributes.position,normals=geometry.attributes.normal,uv=geometry.attributes.uv;
        const relative=new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld),normalMatrix=new THREE.Matrix3().getNormalMatrix(relative),p=new THREE.Vector3(),n=new THREE.Vector3();
        cached={original:uv.array.slice(),positions:new Float32Array(positions.count*3),axes:[],signature:null};
        for(let i=0;i<positions.count;i++){
          p.fromBufferAttribute(positions,i).applyMatrix4(relative);p.toArray(cached.positions,i*3);
          n.fromBufferAttribute(normals,i).applyMatrix3(normalMatrix).normalize();
          const top=Math.abs(n.y)>Math.max(Math.abs(n.x),Math.abs(n.z));
          cached.axes.push(top?['x','z']:Math.abs(n.x)>Math.abs(n.z)?['z','y']:['x','y']);
        }
        wallUV.set(mesh,cached);
      }
      if(cached.signature===signature)return;
      const uv=mesh.geometry.attributes.uv;
      for(let i=0;i<uv.count;i++){
        const [u,v]=cached.axes[i];
        if(id===null)uv.setXY(i,cached.original[i*2]*scale[u],cached.original[i*2+1]*scale[v]);
        else{
          const coordinate=component=>cached.positions[i*3+({x:0,y:1,z:2}[component])]-r.localBounds.min[component];
          // All wall segments share one coordinate system, including door
          // headers, end caps and top faces. Texture repeat then converts to m.
          uv.setXY(i,coordinate(u)*scale[u]/(size[axis(r)]*scale[axis(r)]),coordinate(v)*scale[v]/(size.y*scale.y));
        }
      }
      uv.needsUpdate=true;cached.signature=signature;
    });
  }
  function setMaterial(r,id){
    if(id!==null&&!styles.some(s=>s.id===id))return false;
    for(const material of r.paint){
      const previousMap=material.map;
      if(!originalMaps.has(material))originalMaps.set(material,{map:material.map,roughness:material.roughness});
      if(id===null){Object.assign(material,originalMaps.get(material))}
      else{const key=r.id+':'+id;let map=materialMaps.get(key);if(!map){map=styles.find(s=>s.id===id).texture.clone();map.needsUpdate=true;materialMaps.set(key,map)}const size=r.localBounds.getSize(new THREE.Vector3());map.repeat.set(size[axis(r)]*r.root.scale[axis(r)]/1.8,size.y*r.root.scale.y/1.8);material.map=map;material.roughness=id==='wood'?.7:.88}
      if(material.map!==previousMap)material.needsUpdate=true;
    }r.wallMaterial=id;updateWallUV(r,id);return true;
  }
  for(const r of system.all()){if(r.kind==='mounted')bind(r,r.mountWallId);else bindSupport(r)}
  for(const r of system.all())if(r.mount)system.templates.get(r.sourceId).mount=structuredClone(r.mount);
  sync();
  function minimumLength(wallId){const w=system.get(wallId);return Math.max(stacking.minimumLength(w),...system.all().filter(r=>r.kind==='mounted'&&r.mount?.wallId===wallId).map(r=>mounting.offsets(r,w).getSize(new THREE.Vector3())[axis(w)]*w.root.scale[axis(w)]+.2))}
  function minimumHeight(wallId){return Math.max(.6,...system.all().filter(r=>r.kind==='mounted'&&r.mount?.wallId===wallId).map(r=>r.localBounds.getSize(new THREE.Vector3()).y+.2))}
  function validWall(r,replacement=null){
    if(stacking.supportId(r))return stacking.valid(r);
    if(r.dynamic)return system.construction.validWall(r.data);
    r.root.updateMatrixWorld(true);const b=(r.collisionBounds||r.localBounds).clone().applyMatrix4(r.root.matrixWorld);
    if(system.construction?.componentDefaults){
      const rooms=system.construction.all().map(v=>v.id===replacement?.id?replacement:v).filter(v=>Math.abs(system.construction.height(v)-(r.root.position.y+(r.wallTop?.38:0)))<.7);
      const xs=[b.min.x,b.max.x,...rooms.flatMap(v=>[v.x-v.width/2,v.x+v.width/2]).filter(x=>x>b.min.x&&x<b.max.x)],zs=[b.min.z,b.max.z,...rooms.flatMap(v=>[v.z-v.depth/2,v.z+v.depth/2]).filter(z=>z>b.min.z&&z<b.max.z)];xs.sort((a,b)=>a-b);zs.sort((a,b)=>a-b);
      for(let i=1;i<xs.length;i++)for(let j=1;j<zs.length;j++){const x=(xs[i-1]+xs[i])/2,z=(zs[j-1]+zs[j])/2;if(!rooms.some(v=>Math.abs(x-v.x)<=v.width/2+.04&&Math.abs(z-v.z)<=v.depth/2+.04))return false}return true;
    }
    const left=['wall-1','wall-3'].includes(r.id),right=['wall-2','wall-4'].includes(r.id);
    const minX=right?-.03:-8.15,maxX=left?.03:8.15;
    return b.min.x>=minX-.001&&b.max.x<=maxX+.001&&b.min.z>=-5.15&&b.max.z<=5.15;
  }
  return{stacking,styles,surfaces:SURFACES,walls,bounds,normal,faceAngle,faces:mounting.faces,classifyFace:mounting.classify,bind,bindSupport,moveMounted,sync,setMaterial,minimumLength,minimumHeight,validWall,groundLayers:foundations.filter(f=>f.mesh.userData.surfaceId==='outdoor'),get footprint(){return footprint}};
}
