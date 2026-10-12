import * as THREE from './vendor/three.module.js';
import {SURFACE_GAP} from './placement.js';

export const SCATTER_CELL=.5,SCATTER_RADIUS=.8,SCATTER_MAX_CELLS=1800;
export const SCATTER_TYPES=[
  {id:'snow',name:'雪',colors:['#f5fbff','#e6f2fa','#ffffff']},
  {id:'petals',name:'花瓣',colors:['#f3a5b6','#de658c','#ffe0e5']},
  {id:'leaves',name:'树叶',colors:['#d18a38','#a8502f','#bdaf50']},
  {id:'ribbons',name:'彩带',colors:['#dc637e','#edbb49','#6caba0','#9a81c5']}
];
export const scatterLevel=amount=>amount>0?Math.min(3,1+Math.floor(amount)):0;
const keyOf=(type,x,z)=>`${type}:${x}:${z}`;
export const SNOW_SIZES=[{radius:.075,height:.025},{radius:.24,height:.15},{radius:.54,height:.34}];
const pieceLayers=(type,level)=>type==='snow'?1:level;
function randomFor(x,z,salt){let value=(Math.imul(x,73856093)^Math.imul(z,19349663)^Math.imul(salt+1,83492791))>>>0;return()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296}}

export function createScatterSystem({scene,system}){
  const root=new THREE.Group();root.name='OutdoorScatter';scene.add(root);
  const records=new Map();let sequence=0,activePatch=null;
  const cells=new Map(),supportCache=new Map(),batches=new Map(),dirty=new Set();
  const transform=new THREE.Object3D(),color=new THREE.Color(),down=new THREE.Raycaster();down.layers.enableAll();
  const geometries={snow:new THREE.SphereGeometry(1,10,6),petals:new THREE.SphereGeometry(1,8,5),leaves:new THREE.SphereGeometry(1,6,3),ribbons:new THREE.BoxGeometry(1,1,1)};
  const materials=Object.fromEntries(SCATTER_TYPES.map(t=>[t.id,new THREE.MeshStandardMaterial({color:'#ffffff',roughness:t.id==='ribbons'?.55:.95})]));
  const indexOf=type=>SCATTER_TYPES.findIndex(t=>t.id===type);
  function piece(type,x,z,layer,index,y=0,level=1){
    const typeIndex=indexOf(type),random=randomFor(x,z,layer*17+index+typeIndex*151),size=.8+random()*.4;
    const snow=type==='snow',height=snow?SNOW_SIZES[level-1].height:type==='ribbons'?.009:.012,spread=snow?.16:.24;
    // Snow keeps the same seven anchors and grows upward from the ground.
    // The full enlarged footprint is checked by support() before thickening.
    transform.position.set(x*SCATTER_CELL+(random()-.5)*spread,y+SURFACE_GAP+typeIndex*.003+height+(snow?0:layer*.023)+(index%3)*.002,z*SCATTER_CELL+(random()-.5)*spread);
    transform.rotation.set(0,random()*Math.PI*2,0);
    if(snow)transform.scale.set(SNOW_SIZES[level-1].radius*size,height,SNOW_SIZES[level-1].radius*size);
    else if(type==='petals')transform.scale.set(.072*size,height,.112*size);
    else if(type==='leaves')transform.scale.set(.059*size,height,.12*size);
    else transform.scale.set(.045*size,height*2,.21*size);
    transform.updateMatrix();color.set(SCATTER_TYPES[typeIndex].colors[Math.floor(random()*SCATTER_TYPES[typeIndex].colors.length)]);
  }
  const catalog=SCATTER_TYPES.map(t=>{
    const model=new THREE.Group();model.name=t.name;
    for(let l=0;l<pieceLayers(t.id,3);l++)for(let i=0;i<7;i++){piece(t.id,0,0,l,i,0,3);const mesh=new THREE.Mesh(geometries[t.id],materials[t.id].clone());mesh.material.color.copy(color);mesh.position.copy(transform.position);mesh.rotation.copy(transform.rotation);mesh.scale.copy(transform.scale);model.add(mesh)}
    return{id:'scatter-'+t.id,sourceId:'scatter-'+t.id,name:t.name,category:'props',scatterType:t.id,root:model};
  });
  function isGround(hit){return hit?.id==='outdoor'&&!!hit.object&&(!hit.record||hit.record.category==='paving')&&!system.construction?.all().some(r=>system.construction.pointInside(hit.point.x,hit.point.z,r))}
  function pick(raycaster){const mask=raycaster.layers.mask;raycaster.layers.enableAll();const hit=system.placement?.pickSurface(raycaster,'__scatter__');raycaster.layers.mask=mask;return isGround(hit)?hit.point:null}
  function support(x,z,radius=.245){
    const key=x+':'+z+':'+radius;if(supportCache.has(key))return supportCache.get(key);
    let height=-Infinity;
    // Test the whole cell, including its edge, so pieces cannot spill indoors
    // or hang over the edge of the miniature's real outdoor ground.
    for(const [dx,dz]of [[0,0],[-radius,-radius],[radius,-radius],[-radius,radius],[radius,radius],[-radius,0],[radius,0],[0,-radius],[0,radius]]){
      down.set(new THREE.Vector3(x*SCATTER_CELL+dx,100,z*SCATTER_CELL+dz),new THREE.Vector3(0,-1,0));const hit=system.placement?.pickSurface(down,'__scatter__');
      if(!isGround(hit)){height=null;break}height=Math.max(height,hit.point.y);
    }
    supportCache.set(key,height);return height;
  }
  const footprint=(type,amount)=>type==='snow'?Math.max(.245,SNOW_SIZES[scatterLevel(amount)-1].radius*1.2+.08):.245;
  const cellSupport=c=>support(c.x+(c.dx||0)/SCATTER_CELL,c.z+(c.dz||0)/SCATTER_CELL,footprint(c.type,c.amount));
  function beginStroke(){activePatch=null}
  function endStroke(){activePatch=null}
  function nextPatch(){let id;do{id='spray-'+(++sequence)}while(records.has(id)||[...cells.values()].some(c=>c.patch===id));return id}
  function paint(type,point,seconds){
    if(indexOf(type)<0||!point||![point.x,point.z,seconds].every(Number.isFinite)||seconds<=0)return false;
    let changed=false;
    const minX=Math.ceil((point.x-SCATTER_RADIUS)/SCATTER_CELL),maxX=Math.floor((point.x+SCATTER_RADIUS)/SCATTER_CELL),minZ=Math.ceil((point.z-SCATTER_RADIUS)/SCATTER_CELL),maxZ=Math.floor((point.z+SCATTER_RADIUS)/SCATTER_CELL);
    for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){
      if(Math.hypot(x*SCATTER_CELL-point.x,z*SCATTER_CELL-point.z)>SCATTER_RADIUS)continue;
      const old=[...cells.values()].find(c=>c.type===type&&Math.abs(c.x*SCATTER_CELL+(c.dx||0)-x*SCATTER_CELL)<.001&&Math.abs(c.z*SCATTER_CELL+(c.dz||0)-z*SCATTER_CELL)<.001);const key=old?old.patch+':'+keyOf(type,old.x,old.z):null;if(!old&&cells.size>=SCATTER_MAX_CELLS)continue;
      const amount=Math.min(2.1,(old?.amount||0)+seconds);if(old?.amount===amount||support(x,z,footprint(type,amount))===null)continue;
      if(scatterLevel(old?.amount)!==scatterLevel(amount))dirty.add(type);
      activePatch??=nextPatch();const cell=old?{...old,amount}:{type,x,z,amount,patch:activePatch,dx:0,dz:0};cells.set(key||cell.patch+':'+keyOf(type,x,z),cell);changed=true;
    }
    return changed;
  }
  function stroke(type,from,to,seconds){
    const steps=from?Math.max(1,Math.ceil(from.distanceTo(to)/.25)):1;
    // Avoid spending a hidden tab's elapsed time on a single patch.
    const elapsed=Math.min(.15,Math.max(0,seconds));let changed=false;
    for(let i=1;i<=steps;i++)changed=paint(type,from?from.clone().lerp(to,i/steps):to,elapsed/steps)||changed;
    flush();return changed;
  }
  function rebuild(type){
    const visible=[...cells.values()].filter(c=>c.type===type&&cellSupport(c)!==null),count=visible.reduce((n,c)=>n+pieceLayers(type,scatterLevel(c.amount))*7,0);
    let mesh=batches.get(type);
    if(!mesh||mesh.instanceMatrix.count<count){
      if(mesh){mesh.removeFromParent();mesh.dispose()}
      mesh=new THREE.InstancedMesh(geometries[type],materials[type],Math.max(64,2**Math.ceil(Math.log2(Math.max(1,count)))));mesh.name='Scatter-'+type;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.receiveShadow=true;mesh.castShadow=false;root.add(mesh);batches.set(type,mesh);
    }
    mesh.userData.patches=[];let at=0;for(const c of visible)for(let l=0;l<pieceLayers(type,scatterLevel(c.amount));l++)for(let i=0;i<7;i++){piece(type,c.x,c.z,l,i,cellSupport(c),scatterLevel(c.amount));transform.position.x+=c.dx||0;transform.position.z+=c.dz||0;transform.updateMatrix();mesh.userData.patches[at]=c.patch;mesh.setMatrixAt(at,transform.matrix);mesh.setColorAt(at++,color)}
    mesh.count=at;mesh.visible=at>0;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();
  }
  function syncRecords(){
    const bounds=new Map(),types=new Map(),matrix=new THREE.Matrix4(),unit=new THREE.Box3();
    for(const [type,mesh]of batches){mesh.geometry.computeBoundingBox();for(let i=0;i<mesh.count;i++){const id=mesh.userData.patches[i];if(!bounds.has(id))bounds.set(id,new THREE.Box3());mesh.getMatrixAt(i,matrix);unit.copy(mesh.geometry.boundingBox).applyMatrix4(matrix);bounds.get(id).union(unit);types.set(id,type)}}
    for(const r of records.values())r.root.visible=false;
    for(const [id,b]of bounds){let r=records.get(id);if(!r){const proxy=new THREE.Group(),invisible=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({visible:false}));proxy.userData.furnitureId=id;invisible.userData.editorHelper=true;proxy.add(invisible);scene.add(proxy);r={id,kind:'scatter',category:'props',name:'喷洒道具',root:proxy,localBounds:new THREE.Box3(),paint:[materials[types.get(id)]],surface:'outdoor'};records.set(id,r)}
      r.root.visible=true;r.root.position.copy(b.getCenter(new THREE.Vector3()));const child=r.root.children[0];child.scale.copy(b.getSize(new THREE.Vector3()));r.localBounds.copy(b).translate(r.root.position.clone().negate());r.root.updateMatrixWorld(true);
    }
  }
  function flush(){if(!dirty.size)return;for(const type of dirty)rebuild(type);dirty.clear();syncRecords()}
  function resolveHit(hit){const id=hit.object.userData.patches?.[hit.instanceId],r=records.get(id);return r?{...hit,object:r.root}:hit}
  function move(id,x,z){const r=records.get(id);if(!r||![x,z].every(Number.isFinite))return false;const dx=x-r.root.position.x,dz=z-r.root.position.z,selected=[...cells.values()].filter(c=>c.patch===id),moved=selected.map(c=>({...c,dx:(c.dx||0)+dx,dz:(c.dz||0)+dz}));supportCache.clear();
    if(moved.some(c=>Math.abs(c.x*SCATTER_CELL+c.dx)>150||Math.abs(c.z*SCATTER_CELL+c.dz)>150||cellSupport(c)===null)){r.root.userData.placementInvalid=true;return false}
    moved.forEach((c,i)=>Object.assign(selected[i],c));for(const c of moved)dirty.add(c.type);flush();r.root.userData.placementInvalid=false;return true;
  }
  function remove(id){for(const [key,c]of cells)if(c.patch===id){cells.delete(key);dirty.add(c.type)}flush()}
  function refresh(){supportCache.clear();scene.updateMatrixWorld(true);for(const t of SCATTER_TYPES)if(batches.has(t.id)||[...cells.values()].some(c=>c.type===t.id))dirty.add(t.id);flush()}
  function serialize(){return [...cells.values()].map(c=>({...c,amount:Math.round(c.amount*10000)/10000})).sort((a,b)=>a.type.localeCompare(b.type)||a.x-b.x||a.z-b.z)}
  function load(data){
    cells.clear();activePatch=null;const legacy=new Map();if(Array.isArray(data))for(const c of data.slice(0,SCATTER_MAX_CELLS)){
      if(!c||indexOf(c.type)<0||!Number.isInteger(c.x)||!Number.isInteger(c.z)||Math.abs(c.x)>300||Math.abs(c.z)>300||!Number.isFinite(c.amount)||c.amount<=0)continue;
      // Old saves are grouped by type; new strokes retain their own patch identity.
      if(!legacy.has(c.type))legacy.set(c.type,nextPatch());
      const patch=/^spray-\d+$/.test(c.patch)?c.patch:legacy.get(c.type),dx=Number.isFinite(c.dx)&&Math.abs(c.dx)<=300?c.dx:0,dz=Number.isFinite(c.dz)&&Math.abs(c.dz)<=300?c.dz:0;
      cells.set(patch+':'+keyOf(c.type,c.x,c.z),{type:c.type,x:c.x,z:c.z,amount:Math.min(2.1,c.amount),patch,dx,dz});
    }
    refresh();
  }
  function levelAt(type,point){return Math.max(0,...[...cells.values()].filter(c=>c.type===type&&Math.abs(c.x*SCATTER_CELL+c.dx-point.x)<=SCATTER_CELL/2&&Math.abs(c.z*SCATTER_CELL+c.dz-point.z)<=SCATTER_CELL/2).map(c=>scatterLevel(c.amount)))}
  system.subscribe(type=>{if(type==='commit')refresh()});
  return{root,catalog,beginStroke,endStroke,get:id=>records.get(id)||null,resolveHit,move,remove,pick,paint,stroke,flush,refresh,serialize,load,levelAt,get full(){return cells.size>=SCATTER_MAX_CELLS},get size(){return cells.size}};
}
