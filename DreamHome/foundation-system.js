import * as THREE from './vendor/three.module.js';

export const FOUNDATION_BORDER=.2,GROUND_MARGIN=1,GROUND_TOP=.14;
export const ORIGINAL_FOUNDATION_COLOR='#c3b29c';

// Floor finishes belong only to the inset top, never to the plinth's sides.
// Coordinates are relative to the finished floor so existing layouts stay put.
export function createRoomFoundation({width,depth,level=1,color='#eee1cb',material}){
  const root=new THREE.Group();root.name='RoomFoundation';
  const box=(name,w,h,d,y,mat,surface)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.name=name;mesh.position.y=y;mesh.castShadow=mesh.receiveShadow=true;mesh.userData.surfaceId=surface;root.add(mesh);return mesh};
  const bottom=level===1?GROUND_TOP-1.02:-.2;
  box('FoundationBody',width-.2,-.09-bottom,depth-.2,(bottom-.09)/2,material(color),'foundation');
  box('FoundationBorder',width,.18,depth,-.10,material('#f4e6cd'),'foundation');
  const floorRoot=new THREE.Group();floorRoot.name='RoomFloor';root.add(floorRoot);
  const base=box('FloorFinish',width-2*FOUNDATION_BORDER,.03,depth-2*FOUNDATION_BORDER,-.015,material('#e8d3b3'),'floor-'+level);floorRoot.add(base);
  return{root,floorRoot,base,width:width-2*FOUNDATION_BORDER,depth:depth-2*FOUNDATION_BORDER};
}

// Exact union of axis-aligned rectangles. Interior cell edges have no vertical
// faces; concave outlines, holes and disconnected islands remain intact.
export function groundUnionGeometry(rectangles,bottom,top){
  const rounded=v=>Math.round(v*1e6)/1e6;
  const rects=rectangles.map(r=>Object.fromEntries(Object.entries(r).map(([key,value])=>[key,rounded(value)])));
  const xs=[...new Set(rects.flatMap(r=>[r.minX,r.maxX]))].sort((a,b)=>a-b),zs=[...new Set(rects.flatMap(r=>[r.minZ,r.maxZ]))].sort((a,b)=>a-b);
  const nx=xs.length-1,nz=zs.length-1,cells=new Uint8Array(Math.max(0,nx*nz)),positions=[],uvs=[];
  for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const cx=(xs[x]+xs[x+1])/2,cz=(zs[z]+zs[z+1])/2;cells[z*nx+x]=Number(rects.some(r=>cx>r.minX&&cx<r.maxX&&cz>r.minZ&&cz<r.maxZ))}
  const occupied=(x,z)=>x>=0&&x<nx&&z>=0&&z<nz&&cells[z*nx+x];
  const quad=(a,b,c,d)=>{for(const p of [a,b,c,a,c,d]){positions.push(...p);uvs.push(p[0],p[2])}};
  let area=0;
  for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){
    if(!occupied(x,z))continue;const x0=xs[x],x1=xs[x+1],z0=zs[z],z1=zs[z+1];area+=(x1-x0)*(z1-z0);
    quad([x0,top,z0],[x0,top,z1],[x1,top,z1],[x1,top,z0]);
    quad([x0,bottom,z0],[x1,bottom,z0],[x1,bottom,z1],[x0,bottom,z1]);
    if(!occupied(x-1,z))quad([x0,bottom,z0],[x0,bottom,z1],[x0,top,z1],[x0,top,z0]);
    if(!occupied(x+1,z))quad([x1,bottom,z1],[x1,bottom,z0],[x1,top,z0],[x1,top,z1]);
    if(!occupied(x,z-1))quad([x1,bottom,z0],[x0,bottom,z0],[x0,top,z0],[x1,top,z0]);
    if(!occupied(x,z+1))quad([x0,bottom,z1],[x1,bottom,z1],[x1,top,z1],[x0,top,z1]);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData.area=area;return geometry;
}

export function createFoundationGround({parent,layers=[]}){
  const root=new THREE.Group();root.name='MergedOutdoorGround';root.userData.surfaceId='outdoor';parent.add(root);
  // Replace the original lower platform when extending it, rather than placing
  // overlapping slabs on top. With no additions its authored bevels return.
  const originals=layers.map(({mesh,bounds})=>({mesh,parent:mesh.parent,bounds}));
  const definitions=originals.length?originals.map((v,i)=>({material:v.mesh.material,bounds:v.bounds,margin:i===0?GROUND_MARGIN-.1:GROUND_MARGIN})):[];
  let signature='';
  function update(rooms,plots=[]){
    const bases=rooms.filter(r=>r.level===1),next=JSON.stringify([bases,plots].map(list=>list.map(r=>[r.x,r.z,r.width,r.depth])));if(next===signature)return;signature=next;
    for(const mesh of root.children)mesh.geometry.dispose();root.clear();
    if(!bases.length&&!plots.length){for(const v of originals)if(!v.mesh.parent)v.parent.add(v.mesh);return}
    for(const v of originals)v.mesh.removeFromParent();
    for(const layer of definitions){
      const b=layer.bounds,rectangle=(r,margin)=>({minX:r.x-r.width/2-margin,maxX:r.x+r.width/2+margin,minZ:r.z-r.depth/2-margin,maxZ:r.z+r.depth/2+margin});
      const rectangles=[{minX:b.min.x,maxX:b.max.x,minZ:b.min.z,maxZ:b.max.z},...bases.map(r=>rectangle(r,layer.margin)),...plots.map(r=>rectangle(r,layer.margin-GROUND_MARGIN))];
      const mesh=new THREE.Mesh(groundUnionGeometry(rectangles,b.min.y,b.max.y),layer.material);mesh.name='ContinuousGroundLayer';mesh.userData.surfaceId='outdoor';mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
    }
    root.updateMatrixWorld(true);
  }
  return{root,update};
}
