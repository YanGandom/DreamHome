import * as THREE from './vendor/three.module.js';

export const WOOD_FINISHES=[
  {name:'胡桃木色',color:'#60402e',body:'#76503a',tread:'#ac8057'},
  {name:'原木色',color:'#c49a62',body:'#a87c4d',tread:'#e1bd88'},
  {name:'白色',color:'#f4f1e8',body:'#dfdcd1',tread:'#c8a77b'}
];
const ownedResources=new WeakMap();
export function applyWoodFinish(record,color){
  const finish=WOOD_FINISHES.find(f=>f.color===color)||WOOD_FINISHES[0];
  record.color=finish.color;
  record.root.traverse(o=>{if(o.isMesh){const role=o.material.userData.woodRole||'rail';o.material.color.set(role==='body'?finish.body:role==='tread'?finish.tread:finish.color)}});
}

// Rebuild the rail at physical dimensions: only the handrail gets longer.
// Turned balusters keep their shape and a maximum spacing of 43 cm.
export function rebuildRailing(record,width){
  width=THREE.MathUtils.clamp(width,1,20);
  const root=record.root;
  // Templates and new copies can share geometry; dispose only this root's own rebuild.
  const owned=ownedResources.get(root);if(owned){owned.posts.dispose();owned.posts.geometry.dispose();owned.rail.geometry.dispose();owned.material.dispose()}root.clear();
  const material=new THREE.MeshStandardMaterial({color:record.color||WOOD_FINISHES[0].color,roughness:.72});material.userData.woodRole='rail';
  const h=record.railingHeight||.946,span=width-.132,count=Math.max(2,Math.ceil(span/.43)+1);
  const profile=[[.07,0],[.07,.12],[.035,.14],[.035,.19],[.063,.24],[.035,.32],[.034,.49],[.055,.58],[.034,.67],[.07,.70],[.07,.80]].map(([r,y])=>new THREE.Vector2(r,y*(h-.12)/.8));
  const posts=new THREE.InstancedMesh(new THREE.LatheGeometry(profile,10),material,count),matrix=new THREE.Matrix4();posts.name='RailingBalusters';
  for(let i=0;i<count;i++){matrix.makeTranslation(-span/2+span*i/(count-1),0,0);posts.setMatrixAt(i,matrix)}
  const rail=new THREE.Mesh(new THREE.BoxGeometry(width,.132,.132),material);rail.name='RailingHandrail';rail.position.y=h-.066;root.add(posts,rail);ownedResources.set(root,{posts,rail,material});
  root.traverse(o=>{o.userData.furnitureId=record.id;if(o.isMesh){o.userData.parametricRail=true;o.castShadow=o.receiveShadow=true}});
  record.railingWidth=width;record.paint=[material];record.localBounds=new THREE.Box3(new THREE.Vector3(-width/2,0,-.07),new THREE.Vector3(width/2,h,.07));root.updateMatrixWorld(true);
}
