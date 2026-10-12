import * as THREE from './vendor/three.module.js';

// In metres: repeated panels and trim keep physical dimensions as the wall grows.
const owned=new WeakMap();
export function syncWallDetails(record){
  const d=record.wainscot;if(!d)return;
  const root=record.root,scale=root.scale,signature=scale.toArray().join(':')+':'+(record.wallPiers||[]).join(',');
  if(owned.get(root)?.signature===signature)return;
  const old=root.getObjectByName('WallWainscot');if(old){old.removeFromParent();if(owned.has(root))old.traverse(o=>{o.geometry?.dispose();o.material?.dispose()})}
  const group=new THREE.Group();group.name='WallWainscot';group.userData.furnitureId=record.id;
  group.position.fromArray(d.center);group.position.y=d.bottom/scale.y;
  // Keep the entire backing 1 cm in front of the wall, including side walls.
  const cross=record.lengthAxis==='z'?'x':'z',body=record.collisionBounds;
  if(body)group.position[cross]=body.max[cross]+(.065+.01)/scale[cross];
  group.rotation.y=record.lengthAxis==='z'?Math.PI/2:0;
  // X/Z lengths are converted to metres before inverse scaling the assembly.
  group.scale.set(1/scale[record.lengthAxis],1/scale.y,1/scale[record.lengthAxis==='z'?'x':'z']);root.add(group);
  const width=Math.max(.1,d.width*scale[record.lengthAxis]),wallHeight=record.localBounds.getSize(new THREE.Vector3()).y*scale.y,h=Math.min(1.35,wallHeight-.02);
  const material=color=>new THREE.MeshStandardMaterial({color,roughness:.78});
  function box(name,w,yHeight,depth,x,y,z,color){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,yHeight,depth),material(color));mesh.name=name;mesh.position.set(x,y,z);mesh.userData.furnitureId=record.id;mesh.castShadow=mesh.receiveShadow=true;group.add(mesh)}
  box('WainscotBacking',width,Math.max(.01,h-.02),.13,0,h/2,0,'#b77c3f');
  box('WainscotCrown',width+.02,.10,.20,0,h-.04,.04,'#e8d3b3');
  box('WainscotBase',width+.04,.12,.18,0,.08,.035,'#503724');
  const pitch=.74,count=Math.max(0,Math.floor((width-.12)/pitch)),panelHeight=Math.min(.96,Math.max(.05,h-.3));
  for(let i=0;i<count;i++){
    const x=(i-(count-1)/2)*pitch;
    box('WainscotPanel',.59,panelHeight,.07,x,.17+panelHeight/2,.12,'#503724');
    box('WainscotInset',.49,Math.max(.02,panelHeight-.12),.05,x,.17+panelHeight/2,.19,'#b77c3f');
  }
  // End piers retain their cross-section; bands repeat vertically at a fixed pitch.
  // All dimensions here are metres because the parent cancels the wall scaling.
  for(const localX of record.wallPiers||[]){
    const x=(localX-d.center[0])*scale.x;
    const pierHeight=Math.max(.2,wallHeight-.30),bottom=.02;
    // The assembly already sits 7.5 cm in front of the wall face. Subtract
    // that offset to retain the authored pier centres (3.5 / 10.5 cm).
    // Piers overlap the wall as corner trim instead of floating off its face.
    const faceOffset=body?(body.max[cross]-group.position[cross])*scale[cross]:-.075;
    box('WallPierBody',.30,pierHeight,.34,x,bottom+pierHeight/2,faceOffset+.035,'#e8d3b3');
    const count=Math.max(1,Math.floor((pierHeight-.08)/.43)+1);
    for(let i=0;i<count;i++)box('WallPierBand',.39,.08,.42,x,bottom+.04+i*.43,faceOffset+.105,'#f4e6cd');
  }
  root.userData.wallDetailRevision=signature;owned.set(root,{signature});root.updateMatrixWorld(true);
}
