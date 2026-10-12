import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';
import { createFurnitureSystem } from './furniture-system.js';
import { createSceneEditor } from './editor.js';
import { createPlacement } from './placement.js';
import { createFloorSystem } from './floor-system.js';
import { createArchitectureSystem } from './architecture-system.js';
import { createSceneMenu } from './scene-menu.js';
import { createBuildingSystem } from './building-system.js';
import { createScatterSystem } from './scatter-system.js';

const mount=document.querySelector('#scene');
// Some embedded browsers cannot allocate an antialiased WebGL context.
// Retry without MSAA before reporting a graphics capability problem.
let renderer;
const attempts=[{antialias:true,powerPreference:'default'},{antialias:false,powerPreference:'low-power'}];
let graphicsError;
for(const options of attempts){try{renderer=new THREE.WebGLRenderer({...options,alpha:false,preserveDrawingBuffer:true});break}catch(error){graphicsError=error}}
if(!renderer)throw new Error('WebGL 2 初始化失败：'+(graphicsError?.message||'浏览器没有提供可用的 3D 上下文'));
renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();window.__sceneReady=false;window.__sceneFail?.(new Error('WebGL context lost：图形上下文被浏览器关闭。请尝试使用 Chrome 或 Edge 打开此页面。'))});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(mount.clientWidth,mount.clientHeight);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
mount.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#e8e5df');scene.fog=new THREE.Fog('#e8e5df',42,85);
const camera=new THREE.PerspectiveCamera(35,mount.clientWidth/mount.clientHeight,.1,130);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.075;controls.minDistance=6;controls.maxDistance=44;controls.maxPolarAngle=Math.PI*.485;controls.minPolarAngle=.08;controls.autoRotateSpeed=.35;
const world=new THREE.Group();world.name='Architecture';scene.add(world);const motion=new THREE.Group();scene.add(motion);
const staticMeshes=[],flames=[],lights=[],snowCaps=[],furnitureSpecs=[],wallGroups=[],floorSpecs=[];let seed=391;
const foundationMeshes=[],outdoorMeshes=[];
function wallPart(id,build){const start=staticMeshes.length;build();const spec=furnitureSpecs.find(s=>s.id===id);for(const mesh of staticMeshes.slice(start)){mesh.userData.furnitureId=id;spec.meshes.push(mesh)}}
function mounted(id,name,wallId,build,paint=[]){furnishing(id,name,'mounted',build,paint);Object.assign(furnitureSpecs.at(-1),{mountWallId:wallId,kind:'mounted'});}
function furnishing(id,name,category,build,paintMaterials=[]){const start=staticMeshes.length,lightStart=lights.length;build();const meshes=staticMeshes.slice(start);for(const mesh of meshes)mesh.userData.furnitureId=id;furnitureSpecs.push({id,name,category,meshes,paintMaterials,attachments:lights.slice(lightStart)});}
function roomFloor(id,name,width,depth,build){const start=staticMeshes.length;build();const meshes=staticMeshes.slice(start);for(const mesh of meshes)mesh.userData.roomId=id;floorSpecs.push({id,name,width,depth,meshes});}
function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
const materials={};
function mat(name,color,rough=.65,metal=0){const m=new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal});materials[name]=m;return m}
const M={cream:mat('cream','#e8d3b3'),ivory:mat('ivory','#f4e6cd'),stone:mat('stone','#c3b29c'),stoneDark:mat('stoneDark','#998d7d'),mortar:mat('mortar','#b29b85'),brick:mat('brick','#bb6b72'),brick2:mat('brick2','#ca7c82'),snow:mat('snow','#f5fbff',.94),wood:mat('wood','#824920'),woodDark:mat('woodDark','#503724'),woodLight:mat('woodLight','#b77c3f'),gold:mat('gold','#d5a344',.3,.48),goldLight:mat('goldLight','#efd18a',.35,.3),green:mat('green','#437244'),greenLight:mat('greenLight','#799453'),red:mat('red','#902e42'),redLight:mat('redLight','#bd4358'),teal:mat('teal','#284b4d'),navy:mat('navy','#263d50'),yellow:mat('yellow','#e5a936'),yellowLight:mat('yellowLight','#f3ca63'),pink:mat('pink','#e49b9d'),leaf:mat('leaf','#36683c'),leafLight:mat('leafLight','#71984b'),soil:mat('soil','#423024'),pot:mat('pot','#b77146'),steel:mat('steel','#9fa7a3',.31,.65),dark:mat('dark','#293236'),paper:mat('paper','#f5e5c5'),water:mat('water','#7eacb5',.2,.18),white:mat('white','#fff6e2'),cushion:mat('cushion','#d9cda8')};
M.glow=new THREE.MeshStandardMaterial({color:'#ffdc7d',emissive:'#ffb441',emissiveIntensity:1.15,roughness:.5});M.flame=new THREE.MeshBasicMaterial({color:'#ffac26',transparent:true,opacity:.92});M.flameCore=new THREE.MeshBasicMaterial({color:'#ffefaa'});
const geos={box:new THREE.BoxGeometry(1,1,1),sphere:new THREE.SphereGeometry(1,16,10),cyl:new THREE.CylinderGeometry(1,1,1,16)};
function add(geo,m,x,y,z,parent=world){const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);if(parent===world)staticMeshes.push(o);return o}
function box(x,y,z,w,h,d,m,b=0){const geo=b?new RoundedBoxGeometry(w,h,d,2,Math.min(b,w/3,h/3,d/3)):geos.box;const o=add(geo,m,x,y,z);if(!b)o.scale.set(w,h,d);return o}
function wallBox(...args){const id='wall-'+(wallGroups.length+1),lengthAxis=args[3]>args[5]?'x':'z';let mesh;furnishing(id,['会客厅后墙','大堂后墙','会客厅侧墙','大堂侧墙'][wallGroups.length],'walls',()=>{mesh=box(...args)},[args[6]]);Object.assign(furnitureSpecs.at(-1),{kind:'wall',lengthAxis,interiorSign:(lengthAxis==='x'?args[2]:args[0])>0?-1:1,wallTop:false});wallGroups.push([mesh]);return mesh}
function ell(x,y,z,sx,sy,sz,m){const o=add(geos.sphere,m,x,y,z);o.scale.set(sx,sy,sz);return o}
function cyl(x,y,z,r,h,m,rt=r,N=24){return add(new THREE.CylinderGeometry(rt,r,h,N),m,x,y,z)}
function tor(x,y,z,r,t,m,rot=[Math.PI/2,0,0]){const o=add(new THREE.TorusGeometry(r,t,7,36),m,x,y,z);o.rotation.set(...rot);return o}
function beam(a,b,r,m,r2=r){const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b);const o=add(new THREE.CylinderGeometry(r2,r,A.distanceTo(B),12),m,...A.clone().add(B).multiplyScalar(.5).toArray());o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),B.sub(A).normalize());return o}
function curve(points,r,m){return add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),Math.max(12,points.length*5),r,7,false),m,0,0,0)}
function lathe(x,y,z,profile,m,scale=1){const o=add(new THREE.LatheGeometry(profile.map(([r,h])=>new THREE.Vector2(r,h)),24),m,x,y,z);o.scale.setScalar(scale);return o}
function groupBuild(x,y,z,angle,fn){const start=staticMeshes.length;fn();const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),angle);for(const o of staticMeshes.slice(start)){o.position.applyQuaternion(q).add(new THREE.Vector3(x,y,z));o.quaternion.premultiply(q)}return staticMeshes.slice(start)}
function canvasTex(draw,w=512,h=512){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t}
const wallpaperTexture=canvasTex((c,w,h)=>{c.fillStyle='#d4a044';c.fillRect(0,0,w,h);c.strokeStyle='#f7d17e';c.lineWidth=1.2;for(let y=0;y<h;y+=64)for(let x=0;x<w;x+=48){c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x+35,y+16,x-22,y+40,x+22,y+64);c.moveTo(x+20,y);c.bezierCurveTo(x-12,y+16,x+42,y+40,x,y+64);c.stroke();c.beginPath();c.ellipse(x+16,y+32,7,15,.5,0,Math.PI*2);c.stroke()}});
wallpaperTexture.wrapS=wallpaperTexture.wrapT=THREE.RepeatWrapping;wallpaperTexture.repeat.set(4,2.2);
M.wallpaper=new THREE.MeshStandardMaterial({map:wallpaperTexture,roughness:.9});
const redTexture=canvasTex((c,w,h)=>{c.fillStyle='#a95050';c.fillRect(0,0,w,h);c.strokeStyle='#cc7870';c.lineWidth=2;for(let y=-32;y<h;y+=72)for(let x=-32;x<w;x+=64){c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+30,y+15,x+32,y+36);c.quadraticCurveTo(x+2,y+50,x,y+72);c.quadraticCurveTo(x-32,y+50,x-32,y+36);c.quadraticCurveTo(x-2,y+12,x,y);c.stroke()}});
redTexture.wrapS=redTexture.wrapT=THREE.RepeatWrapping;redTexture.repeat.set(3,1.2);M.redwall=new THREE.MeshStandardMaterial({map:redTexture});
const floorTex=canvasTex((c,w,h)=>{c.fillStyle='#b67e47';c.fillRect(0,0,w,h);for(let j=0;j<8;j++){const y=j*64;c.fillStyle=j%2?'#b37b43':'#c18a50';c.fillRect(0,y,w,63);c.strokeStyle='#70451f66';c.lineWidth=2;c.strokeRect(0,y,w,64);for(let i=0;i<22;i++){c.strokeStyle=i%2?'#e4b07144':'#85532b33';c.lineWidth=.4+rnd();let yy=y+rnd()*60;c.beginPath();c.moveTo(0,yy);c.bezierCurveTo(150,yy+4,350,yy-3,512,yy+2);c.stroke()}c.fillStyle='#74451f';c.fillRect((j%3)*165+40,y,1,64)}});
floorTex.wrapS=floorTex.wrapT=THREE.RepeatWrapping;floorTex.repeat.set(2.8,3);M.woodFloor=new THREE.MeshStandardMaterial({map:floorTex,roughness:.58});
function rug(x,z,w,d,kind=0){const tex=canvasTex((c,W,H)=>{c.fillStyle=kind?'#bd8254':'#d7b486';c.fillRect(0,0,W,H);c.strokeStyle=kind?'#273d55':'#855e3d';c.lineWidth=24;c.strokeRect(20,20,W-40,H-40);c.strokeStyle='#f2d5a0';c.lineWidth=7;c.strokeRect(31,31,W-62,H-62);for(let i=0;i<8;i++){c.strokeStyle=kind?'#243c51':'#ebd0a4';c.lineWidth=5;c.beginPath();if(kind){c.moveTo(55+i*56,62);c.lineTo(72+i*56,95);c.lineTo(44+i*56,130)}else c.ellipse(65+i*56,80,25,45,.5,0,Math.PI*2);c.stroke()}c.strokeStyle=kind?'#293d54':'#f5dcb8';c.lineWidth=12;for(let a=0;a<12;a++){let an=a*Math.PI/6;c.beginPath();c.ellipse(256+Math.cos(an)*125,256+Math.sin(an)*125,35,60,an,0,Math.PI*2);c.stroke()}});const m=new THREE.MeshStandardMaterial({map:tex,roughness:1});const o=add(new THREE.PlaneGeometry(w,d),m,x,1.025,z);o.rotation.x=-Math.PI/2;return o}

// Architecture: a completely modeled open-roof, two-room miniature.
box(0,-.345,1,18.3,.85,15.2,M.stone,.22);box(0,.05,1,18.5,.18,15.4,M.cream,.08);
foundationMeshes.push(...staticMeshes);for(const [i,mesh]of foundationMeshes.entries())mesh.userData.surfaceId=i<2?'outdoor':'foundation';
roomFloor('lobby','酒店大堂',7.6,9.4,()=>box(3.7,1.005,0,7.6,.025,9.4,M.woodFloor));
roomFloor('salon','会客厅',7.8,9.4,()=>{
box(-4,1.005,0,7.8,.025,9.4,M.cream);
for(let x=-7.7;x<-.2;x+=.72)for(let z=-4.5;z<4.6;z+=.72){const tile=box(x+.33,1.025,z+.33,.49,.025,.49,(Math.round((x+7.7)/.72)+Math.round((z+4.5)/.72))%3?M.ivory:M.stone,.04);tile.rotation.y=Math.PI/4}
});
wallBox(-3.92,3.90,-4.70,7.85,5.8,.25,M.wallpaper);wallBox(3.92,3.02,-4.70,7.85,4.04,.25,M.redwall);
wallBox(-7.83,3.90,-2.70,.26,5.8,4.28,M.wallpaper);wallBox(7.83,2.90,-2.55,.26,3.8,4.3,M.redwall);
function wainscot(x,y,z,w,side=false){const first=staticMeshes.length;groupBuild(x,y,z,side?Math.PI/2:0,()=>{box(0,.63,0,w,1.26,.13,M.woodLight);box(0,1.3,.035,w+.02,.10,.18,M.cream);box(0,.08,.025,w,.12,.18,M.woodDark);for(let xx=-w/2+.1;xx<w/2;xx+=.74){box(xx+.3,.65,.08,.59,.96,.07,M.woodDark,.02);box(xx+.3,.65,.127,.49,.84,.05,M.woodLight,.015)}});for(const mesh of staticMeshes.slice(first))mesh.userData.wainscot=true}
wallPart('wall-2',()=>wainscot(3.8,1,-4.51,7.8));wallPart('wall-1',()=>wainscot(-4,1,-4.51,7.5));wallPart('wall-3',()=>wainscot(-7.65,1,-2.7,4.1,true));
for(const [id,x,w,h]of [['wall-1',-3.92,7.9,6.82],['wall-2',3.92,7.9,5.05]])wallPart(id,()=>{box(x,h,-4.70,w,.26,.45,M.cream,.035);box(x,h+.13,-4.69,w,.13,.53,M.ivory,.025);box(x,h+.22,-4.67,w,.14,.50,M.snow,.065)});
for(const x of [-7.82,-.02,7.82])wallPart(x<0?'wall-1':'wall-2',()=>{const first=staticMeshes.length;box(x,3.05,-4.54,.30,4.1,.34,M.cream);for(let y=1.1;y<5.1;y+=.43)box(x,y,-4.47,.39,.08,.42,M.ivory,.02);for(const mesh of staticMeshes.slice(first))mesh.userData.wallPier=x});
// Low pink cutaway walls, snow-capped exterior courses.
const brickTexture=canvasTex((c,w,h)=>{c.fillStyle='#c5a99a';c.fillRect(0,0,w,h);const colors=['#bb7378','#bb7378','#c47e82','#bb7378','#ac666e','#b56c73','#bb7378','#ca878a'];const bw=w/8,bh=h/8,gap=w*.003;for(let row=0;row<8;row++)for(let col=-1;col<8;col++){const wrapped=(col+8)%8;c.fillStyle=colors[(wrapped*5+row*3)%colors.length];c.fillRect(col*bw+(row%2)*bw/2+gap/2,row*bh+gap/2,bw-gap,bh-gap)}});brickTexture.wrapS=brickTexture.wrapT=THREE.RepeatWrapping;brickTexture.anisotropy=4;M.brickFinish=new THREE.MeshStandardMaterial({map:brickTexture,roughness:.82});
function brickwall(x,z,w,side=false){wallGroups.push(groupBuild(x,0,z,side?Math.PI/2:0,()=>{const body=box(0,1.18,0,w,1.08,.31,M.brickFinish);const p=body.geometry.attributes.position,n=body.geometry.attributes.normal,uv=body.geometry.attributes.uv;for(let i=0;i<uv.count;i++){const u=Math.abs(n.getX(i))>.5?p.getZ(i):p.getX(i);uv.setXY(i,(u+w/2)/2.32,(p.getY(i)+.54)/1)}box(0,1.73,0,w+.1,.11,.41,M.cream,.025)}))}
for(const [i,x,z,w,side]of [[5,-6.1,4.78,3.2,false],[6,2.35,4.78,10.2,false],[7,-7.82,2.25,4.6,true]]){furnishing('wall-'+i,'庭院矮墙 · '+(i-4),'walls',()=>brickwall(x,z,w,side),[M.brickFinish]);Object.assign(furnitureSpecs.at(-1),{kind:'wall',lengthAxis:side?'z':'x',interiorSign:side?1:-1,wallTop:true})}
// Balcony across the yellow salon, with two descending stair flights.
roomFloor('balcony','二层楼廊',7.42,1.44,()=>box(-4.0,3.885,-3.83,7.42,.055,1.44,M.woodFloor));
function baluster(x,y,z,h=.83,m=M.woodDark){cyl(x,y+.07,z,.09,.14,m);cyl(x,y+h-.06,z,.08,.12,m);cyl(x,y+h*.49,z,.034,h-.17,m);ell(x,y+.25,z,.064,.10,.064,m);ell(x,y+h-.23,z,.055,.10,.055,m)}
function newel(x,y,z,h=1.05){box(x,y+h/2,z,.17,h,.17,M.woodDark,.025);cyl(x,y+h-.02,z,.13,.09,M.woodLight);ell(x,y+h+.10,z,.14,.15,.14,M.woodDark)}
furnishing('balcony-railing','楼廊护栏','stairs',()=>{for(let x=-6.5;x<-.9;x+=.43)baluster(x,3.91,-3.08);beam([-6.65,4.79,-3.08],[-.80,4.79,-3.08],.066,M.woodDark)},[M.woodDark]);
// Sweeping left stair, fan-shaped first treads and graceful curved rails.
const stairY=1.03,stepH=2.87/15;
furnishing('stair-left','弧形木楼梯','stairs',()=>{
const stairPath=[];
for(let i=0;i<15;i++){let t=i/14,x=-6.05-.73*Math.sin(t*Math.PI*.7),z=.25-t*3.95,y=stairY+stepH*(i+1);const o=box(x,(stairY+y)/2,z,1.28,y-stairY,.34,M.wood,.018);o.rotation.y=-.20*Math.sin(t*Math.PI);box(x,y+.017,z,1.33,.06,.36,M.woodLight,.025);stairPath.push([x,y,z]);for(const side of [-1,1]){const xx=x+side*.63;if(i%2===0)baluster(xx,y+.04,z,.83);}}
for(const side of [-1,1])curve(stairPath.map(([x,y,z])=>[x+side*.64,y+.91,z]),.067,M.woodDark);
newel(-5.40,1.2,.32);newel(-6.70,1.2,.32);newel(-6.10,3.94,-3.67);
},[M.wood,M.woodDark,M.woodLight]);
furnishing('stair-right','直线木楼梯','stairs',()=>{
for(let i=0;i<15;i++){let z=1.25-i*.30,y=1.03+stepH*(i+1);box(-1.20,(1.03+y)/2,z,1.34,y-1.03,.32,M.wood);box(-1.20,y+.024,z,1.41,.065,.35,M.woodLight,.018);for(const x of [-1.91,-.49]){if(i%2===0)baluster(x,y+.055,z,.78)}}
for(const x of [-1.91,-.49]){beam([x,2.0,1.28],[x,4.81,-2.97],.065,M.woodDark);newel(x,1.11,1.41);newel(x,3.9,-3.1)}
},[M.wood,M.woodDark,M.woodLight]);

// Windows with pane depth, raised frames and sculpted curtain folds.
const windowTex=canvasTex((c,w,h)=>{const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#bed4d7');g.addColorStop(.48,'#edf6ef');g.addColorStop(1,'#8b9d8d');c.fillStyle=g;c.fillRect(0,0,w,h);for(let i=0;i<12;i++){c.fillStyle=i%2?'#cadbd0':'#8fa89f';let x=rnd()*w,y=150+rnd()*280;c.beginPath();c.moveTo(x,y-90);c.lineTo(x-60,y+80);c.lineTo(x+60,y+80);c.fill()}c.fillStyle='#f9ffff99';c.beginPath();c.moveTo(0,280);c.lineTo(w,100);c.lineTo(w,180);c.lineTo(0,360);c.fill()});
const glassMat=new THREE.MeshStandardMaterial({map:windowTex,roughness:.26,emissive:'#aec5ca',emissiveIntensity:.13});
function curtain(x,y,z,width,height,m){const geo=new THREE.PlaneGeometry(width,height,14,12);const a=geo.attributes.position;for(let i=0;i<a.count;i++){const xx=a.getX(i),yy=a.getY(i);const t=(yy+height/2)/height;a.setZ(i,Math.cos(xx/width*Math.PI*12)*.045+(1-t)*.025);a.setX(i,xx*(.52+.48*Math.abs(t-.25)));}geo.computeVertexNormals();const o=add(geo,m,x,y,z);o.material.side=THREE.DoubleSide;return o}
function windowUnit(x,y,z,w,h,red=true){box(x,y,z,w+.24,h+.25,.16,M.cream,.025);box(x,y,z+.10,w,h,.05,glassMat);for(const xx of [x-w/2,x,x+w/2])box(xx,y,z+.16,.065,h+.05,.095,M.woodDark);for(const yy of [y-h/2,y,y+h/2])box(x,yy,z+.16,w+.05,.065,.095,M.woodDark);box(x,y-h/2-.11,z+.17,w+.38,.12,.32,M.ivory,.025);box(x,y+h/2+.14,z+.27,w+.50,.15,.28,M.woodLight,.04);for(const sg of [-1,1]){curtain(x+sg*(w*.39),y,z+.29,w*.50,h+.20,red?M.red:M.yellow);tor(x+sg*w*.40,y-h*.17,z+.33,.14,.027,M.gold,[0,0,0]);beam([x+sg*w*.40,y-h*.20,z+.37],[x+sg*w*.40,y-h*.47,z+.37],.024,M.gold);ell(x+sg*w*.40,y-h*.48,z+.37,.06,.10,.06,M.gold)}}
mounted('window-salon-a','窗帘窗组','wall-1',()=>windowUnit(-4.52,5.12,-4.49,1.40,1.94),[M.red]);mounted('window-salon-b','窗帘窗组','wall-1',()=>windowUnit(-2.45,5.12,-4.49,1.40,1.94),[M.red]);
mounted('window-lobby','大堂窗组','wall-2',()=>windowUnit(6.16,3.30,-4.48,2.55,2.64,false),[M.yellow]);
// Back doors at the mezzanine and a small circular transom.
mounted('mezzanine-door','二楼木门','wall-1',()=>{box(-6.34,5.12,-4.42,1.01,2.35,.16,M.wood);for(let y of [4.59,5.54])box(-6.34,y,-4.32,.77,.83,.045,M.woodLight,.04);ell(-6.0,4.92,-4.25,.045,.045,.045,M.gold)},[M.wood,M.woodLight]);
mounted('round-window','圆形气窗','wall-1',()=>{tor(-5.08,6.46,-4.43,.29,.07,M.cream,[0,0,0]);cyl(-5.08,6.46,-4.46,.26,.05,glassMat).rotation.x=Math.PI/2});

// Decorative portraits painted into small frame textures.
function painting(x,y,z,w,h,type=0){if(type!==2){w=.62;h=.86;type=0}const tex=canvasTex((c,W,H)=>{c.fillStyle=['#496578','#668889','#514945'][type%3];c.fillRect(0,0,W,H);if(type%3===2){c.fillStyle='#563522';c.beginPath();c.ellipse(W*.5,H*.43,W*.23,H*.3,0,0,7);c.fill();c.fillStyle='#ddb28a';c.beginPath();c.ellipse(W*.5,H*.42,W*.17,H*.23,0,0,7);c.fill();c.fillStyle='#192d35';c.beginPath();c.moveTo(80,H);c.quadraticCurveTo(W/2,H*.2,W-80,H);c.fill();c.fillStyle='#f5e2be';c.beginPath();c.moveTo(W*.42,H*.65);c.lineTo(W*.5,H*.82);c.lineTo(W*.58,H*.65);c.fill()}else{c.fillStyle='#d8be7f';c.beginPath();c.arc(W*.7,H*.23,35,0,7);c.fill();for(let i=0;i<5;i++){c.fillStyle=['#8ca4a5','#4f7974','#305c58'][i%3];c.beginPath();c.moveTo(0,H);c.lineTo(0,H*.6+i*30);c.quadraticCurveTo(W*.5,H*.15+i*55,W,H*.6+i*30);c.lineTo(W,H);c.fill()}c.fillStyle='#f5dcb4';c.fillRect(W*.38,H*.45,65,140);c.fillStyle='#80483b';c.beginPath();c.moveTo(W*.32,H*.45);c.lineTo(W*.45,H*.30);c.lineTo(W*.60,H*.45);c.fill()}});box(x,y,z,w+.17,h+.17,.10,M.woodDark,.03);box(x,y,z+.06,w+.12,h+.12,.075,M.gold,.03);const m=new THREE.MeshStandardMaterial({map:tex,roughness:.85});box(x,y,z+.11,w,h,.015,m);for(const xx of [x-w/2-.035,x+w/2+.035])ell(xx,y+h/2+.015,z+.08,.055,.08,.04,M.gold)}
for(const [i,x,y,z,w,h,t,wall]of [[1,3.42,3.53,-4.49,1.06,1.40,2,2],[2,1.92,3.32,-4.47,.42,.66,0,2],[3,-4.75,2.31,-4.48,.62,.86,1,1],[4,-3.67,2.38,-4.48,.75,.58,0,1]])mounted('wall-art-'+i,'装饰画 · '+i,'wall-'+wall,()=>painting(x,y,z,w,h,t),[M.gold,M.woodDark]);
for(const [i,x,y,w,h,t]of [[5,0,2.54,.72,.79,0],[6,1.13,2.73,.42,.61,1]])mounted('wall-art-'+i,'装饰画 · '+i,'wall-3',()=>groupBuild(-7.64,0,-.46,Math.PI/2,()=>painting(x,y,0,w,h,t)),[M.gold,M.woodDark]);

function lamp(x,y,z,s=.8){lathe(x,y,z,[[.16,0],[.21,.04],[.13,.12],[.08,.20],[.12,.32],[.085,.40]],M.gold,s);ell(x,y+.45*s,z,.13*s,.18*s,.13*s,M.teal);cyl(x,y+.68*s,z,.27*s,.36*s,M.glow,.135*s);tor(x,y+.50*s,z,.27*s,.016*s,M.gold);tor(x,y+.86*s,z,.136*s,.013*s,M.gold);ell(x,y+.90*s,z,.033*s,.045*s,.033*s,M.gold)}
function sconce(x,y,z,side=0){groupBuild(x,y,z,side,()=>{ell(0,0,0,.14,.23,.07,M.gold);curve([[0,-.12,.05],[0,-.02,.23],[0,.12,.28]],.035,M.gold);cyl(0,.27,.27,.15,.26,M.glow,.08);tor(0,.14,.27,.15,.012,M.gold)});const l=new THREE.PointLight('#ffbc59',9,3,2);l.position.set(x,y+.3,z+.5);scene.add(l);lights.push(l)}
for(const [i,x,y,z,side,wall]of [[1,-6,5.25,-4.35,0,1],[2,-3.49,5.25,-4.35,0,1],[3,-1.11,5.25,-4.35,0,1],[4,.85,3.27,-4.32,0,2],[5,4.54,3.27,-4.32,0,2],[6,-7.43,3.1,-.1,Math.PI/2,3]])mounted('wall-sconce-'+i,'黄铜壁灯','wall-'+wall,()=>sconce(x,y,z,side),[M.gold]);
// Upholstered furniture: carved frames, rolled arms, tufted backs, piped cushions.
function sofa(x,z,w,m,angle=0){return groupBuild(x,1.04,z,angle,()=>{for(const xx of [-w/2+.18,w/2-.18])for(const zz of [-.35,.35]){curve([[xx,.02,zz],[xx*1.02,.18,zz*1.1],[xx,.33,zz]],.055,M.woodDark);ell(xx,.11,zz,.08,.09,.07,M.gold)}box(0,.42,0,w,.22,.90,M.woodLight,.07);box(0,.60,.04,w-.18,.22,.78,m,.12);box(0,1.10,-.38,w-.12,.88,.25,m,.14);curve([[-w/2+.08,.61,-.39],[-w/2+.1,1.34,-.38],[0,1.57,-.40],[w/2-.1,1.34,-.38],[w/2-.08,.61,-.39]],.055,M.gold);for(const xx of [-w/2,w/2]){box(xx,.80,0,.21,.56,.85,m,.10);ell(xx,.93,.25,.15,.20,.17,m);curve([[xx,.48,.4],[xx,.91,.45],[xx,1.06,.14],[xx,1.15,-.37]],.034,M.gold)}const count=Math.max(1,Math.round(w/.72));for(let i=0;i<count;i++){let xx=(i-(count-1)/2)*(w-.22)/count;box(xx,.715,.05,(w-.24)/count-.018,.075,.66,m,.034);ell(xx,1.13,-.228,.035,.035,.014,M.goldLight)}})}
function pillow(x,y,z,m,scale=.3){const p=ell(x,y,z,scale,scale*.83,.14,m);tor(x,y,z+.133,scale*.7,.011,M.goldLight,[0,0,0]);ell(x,y,z+.15,.04,.04,.02,M.gold)}
function coffee(x,z,w=1.6,d=.85){groupBuild(x,1.06,z,0,()=>{for(const xx of [-w*.40,w*.40])for(const zz of [-d*.33,d*.33])curve([[xx,.02,zz],[xx*.88,.19,zz],[xx,.46,zz]],.048,M.woodDark);box(0,.50,0,w,.14,d,M.wood,.14);box(0,.59,0,w-.1,.045,d-.08,M.woodLight,.06);for(const xx of [-w/2+.18,w/2-.18])ell(xx,.43,.02,.10,.08,.14,M.gold)});}
function sideTable(x,z){box(x,1.31,z,.63,.53,.57,M.wood,.04);box(x,1.61,z,.75,.10,.68,M.woodLight,.055);box(x,1.37,z+.31,.48,.15,.027,M.gold);ell(x,1.38,z+.34,.03,.03,.02,M.woodDark)}
function cup(x,y,z){cyl(x,y+.055,z,.07,.11,M.white,.083,16);tor(x+.079,y+.056,z,.045,.014,M.white,[Math.PI/2,Math.PI/2,0]);cyl(x,y+.117,z,.063,.007,M.woodDark);cyl(x,y-.01,z,.12,.016,M.white)}
function books(x,y,z,count=3){for(let i=0;i<count;i++){const o=box(x+(rnd()-.5)*.06,y+i*.07,z,.28,.065,.19,[M.red,M.teal,M.cream][i%3],.008);o.rotation.y=(rnd()-.5)*.24;box(x,y+i*.07,z+.006,.25,.038,.193,M.paper)}}

// Left green salon on an ornate cream rug.
furnishing('salon-rug','会客厅花纹地毯','rugs',()=>rug(-4.49,2.12,4.25,3.22,0));
furnishing('salon-sofa','绒绿双人沙发','seating',()=>{sofa(-5.30,1.28,2.35,M.green);pillow(-5.84,2.12,1.19,M.cushion,.31);pillow(-4.77,2.16,1.18,M.pink,.29)},[M.green]);
furnishing('salon-chair-a','复古扶手椅 · 左','seating',()=>sofa(-6.22,2.95,.84,M.green,-.50),[M.green]);
furnishing('salon-chair-b','复古扶手椅 · 右','seating',()=>sofa(-2.96,1.91,.85,M.green,Math.PI/2*.73),[M.green]);
furnishing('salon-coffee','蕾丝雕花茶几','tables',()=>{coffee(-4.62,2.46,1.76,.85);cup(-4.87,1.75,2.4);books(-4.30,1.76,2.42,2);
const lace=add(new THREE.CircleGeometry(.48,48),M.paper,-4.66,1.758,2.48);lace.rotation.x=-Math.PI/2;lace.scale.y=.63;for(let i=0;i<14;i++){let a=i*Math.PI*2/14;tor(-4.66+Math.cos(a)*.44,1.762,2.48+Math.sin(a)*.25,.055,.009,M.ivory)}
},[M.wood,M.woodLight]);
furnishing('salon-footstool','绒面脚凳','seating',()=>{box(-3.72,1.27,3.23,.65,.36,.58,M.green,.075);for(const x of [-3.96,-3.48])for(const z of [3.04,3.42])cyl(x,1.11,z,.04,.17,M.gold)},[M.green]);
furnishing('salon-lamp-a','古典台灯边桌 · 左','lighting',()=>{sideTable(-6.91,1.03);lamp(-6.91,1.67,1.03,.90)},[M.wood,M.woodLight,M.teal]);
furnishing('salon-lamp-b','古典台灯边桌 · 右','lighting',()=>{sideTable(-3.94,.69);lamp(-3.94,1.67,.69,.86)},[M.wood,M.woodLight,M.teal]);
// Grandfather clock, pendulum behind glass, carved bonnet.
furnishing('grandfather-clock','古董落地钟','decor',()=>{
box(-7.11,2.08,-1.07,.73,2.10,.45,M.wood,.05);box(-7.11,1.03,-1.07,.85,.17,.59,M.woodDark,.035);box(-7.11,3.12,-1.07,.9,.14,.64,M.woodLight,.05);ell(-7.11,3.25,-1.07,.39,.23,.26,M.wood);
box(-7.11,1.92,-.825,.44,1.12,.016,M.dark);beam([-7.11,2.38,-.78],[-7.11,1.47,-.78],.024,M.gold);cyl(-7.11,1.50,-.76,.14,.035,M.gold).rotation.x=Math.PI/2;
const clocktex=canvasTex((c,w,h)=>{c.fillStyle='#f5e5b6';c.beginPath();c.arc(w/2,h/2,w*.47,0,7);c.fill();c.fillStyle='#5d422e';c.font='28px Georgia';c.textAlign='center';c.textBaseline='middle';for(let i=1;i<=12;i++){const a=i*Math.PI/6;c.fillText(i,w/2+Math.sin(a)*183,h/2-Math.cos(a)*183)}c.strokeStyle='#493c2d';c.lineWidth=10;c.beginPath();c.moveTo(256,256);c.lineTo(197,166);c.moveTo(256,256);c.lineTo(365,210);c.stroke()});const clockmat=new THREE.MeshStandardMaterial({map:clocktex});const face=add(new THREE.CircleGeometry(.245,40),clockmat,-7.11,2.78,-.803);tor(-7.11,2.78,-.79,.259,.033,M.gold,[0,0,0]);
},[M.wood,M.woodLight]);
// Bust statue beneath the grand stair landing.
furnishing('bust-statue','大理石半身像','decor',()=>{
box(-3.74,1.49,-1.24,.63,.89,.63,M.wood,.045);box(-3.74,1.96,-1.24,.75,.12,.72,M.woodLight,.03);lathe(-3.74,2.04,-1.24,[[.20,0],[.24,.05],[.11,.14],[.16,.27],[.32,.37],[.30,.46],[.15,.56]],M.ivory);ell(-3.74,2.79,-1.24,.20,.28,.18,M.ivory);ell(-3.74,2.94,-1.30,.24,.18,.19,M.cream);for(let i=0;i<9;i++){let a=i*Math.PI/5;ell(-3.74+Math.sin(a)*.20,2.96+Math.cos(a)*.08,-1.29,.075,.08,.065,M.ivory)}ell(-3.74,2.81,-1.061,.045,.055,.06,M.ivory);

},[M.ivory,M.cream]);
// Partial central wall and emerald arch establish the connected hotel lobby.
furnishing('wall-8','红色半高隔墙','walls',()=>{
box(-.16,2.17,2.31,.24,2.30,3.60,M.redwall);box(-.16,3.34,2.31,.38,.15,3.68,M.cream,.025);
for(let z=.66;z<4;z+=.68)box(-.015,1.62,z,.045,.97,.59,M.woodLight,.02);
},[M.redwall,M.woodLight]);Object.assign(furnitureSpecs.at(-1),{kind:'wall',lengthAxis:'z',interiorSign:1,wallTop:false});
function archDoor(x,z,angle){groupBuild(x,1,z,angle,()=>{box(0,1.11,0,1.37,2.22,.17,M.teal,.025);const shape=new THREE.Shape();shape.moveTo(-.685,0);shape.lineTo(-.685,.30);shape.absarc(0,.30,.685,Math.PI,0,true);shape.lineTo(.685,0);const ob=add(new THREE.ExtrudeGeometry(shape,{depth:.17,bevelEnabled:false}),M.teal,0,2.08,-.085);const pts=[];for(let i=0;i<=24;i++){let a=Math.PI-i*Math.PI/24;pts.push([Math.cos(a)*.75,2.40+Math.sin(a)*.75,.01])}curve([[-.75,.03,.01],[-.75,2.4,.01],...pts,[.75,.03,.01]],.06,M.woodDark);for(const xx of [-.34,.34]){box(xx,1.45,.10,.55,1.15,.025,M.glow);box(xx,.43,.10,.55,.58,.025,M.teal,.03);for(let k=-2;k<=2;k++){beam([xx-.24,1.13+k*.15,.13],[xx+.24,1.77+k*.15,.13],.012,M.teal);beam([xx+.24,1.13+k*.15,.13],[xx-.24,1.77+k*.15,.13],.012,M.teal)}}box(0,1.15,.14,.04,2.23,.055,M.teal);for(let xx of [-.09,.09])beam([xx,.94,.19],[xx,1.20,.19],.02,M.gold)})}
furnishing('emerald-arch-door','翡翠拱门','doors',()=>archDoor(-.05,-.05,Math.PI/2),[M.teal,M.woodDark]);
let firelight;
// Cream marble fireplace faces into the right room.
furnishing('fireplace','大理石壁炉','decor',()=>{groupBuild(.07,1.02,2.10,Math.PI/2,()=>{box(0,.08,0,1.67,.16,.77,M.cream,.04);box(0,.67,-.12,1.31,1.20,.44,M.dark);for(let xx of [-.64,.64]){box(xx,.65,.02,.22,1.16,.57,M.ivory,.035);for(let y of [.18,1.1])box(xx,y,.055,.30,.10,.63,M.cream,.02);for(let dx of [-.05,.05])beam([xx+dx,.28,.325],[xx+dx,.98,.325],.012,M.goldLight)}box(0,1.28,0,1.64,.21,.75,M.ivory,.045);box(0,1.12,.21,.94,.25,.26,M.cream,.02);box(0,1.83,-.17,1.13,.96,.17,M.ivory,.02);tor(0,1.87,-.052,.31,.07,M.gold,[0,0,0]);const mirror=new THREE.MeshStandardMaterial({color:'#849ea7',metalness:.78,roughness:.13});const o=add(new THREE.CircleGeometry(.275,40),mirror,0,1.87,-.045);box(0,2.39,-.10,1.45,.12,.40,M.cream,.025);for(let xx of [-.5,.5]){cyl(xx,1.47,.08,.075,.15,M.gold);cyl(xx,1.64,.08,.028,.25,M.white);ell(xx,1.79,.08,.025,.06,.025,M.glow)}for(let zz of [-.1,.15]){beam([-.41,.28,zz],[.41,.22,zz+.11],.08,M.woodDark)}for(let xx=-.46;xx<=.46;xx+=.18)beam([xx,.17,.41],[xx,.54,.41],.022,M.gold);curve([[-.48,.53,.41],[0,.64,.41],[.48,.53,.41]],.028,M.gold)});
for(let i=0;i<7;i++){const f=add(geos.sphere,i%2?M.flame:M.flameCore,.40+(rnd()-.5)*.2,1.39+rnd()*.17,2.1+(rnd()-.5)*.65,motion);f.scale.set(.09,.23+rnd()*.16,.075);flames.push({mesh:f,base:f.scale.y,phase:rnd()*6})}firelight=new THREE.PointLight('#ff8328',36,4,2);firelight.position.set(.80,1.75,2.1);scene.add(firelight);
},[M.ivory,M.cream]);furnitureSpecs.at(-1).attachments.push(...flames.map(f=>f.mesh),firelight);
// Reception counter, inset navy panels, monitor screens and brass service bell.
furnishing('reception-desk','酒店接待前台','tables',()=>{
groupBuild(4.87,1.04,-2.53,0,()=>{box(0,.53,0,2.90,1.06,.94,M.navy,.17);box(0,.11,.03,3.01,.13,1.01,M.gold,.09);box(0,1.10,0,3.12,.15,1.17,M.wood,.18);for(let xx of [-1.08,-.36,.36,1.08]){box(xx,.61,.478,.61,.73,.03,M.gold,.04);box(xx,.61,.500,.55,.66,.025,M.navy,.03);if(Math.abs(xx)>.5)ell(xx,.68,.53,.04,.09,.02,M.gold)}for(let xx of [-.90,.15]){box(xx,1.23,-.12,.43,.04,.27,M.dark,.02);beam([xx,1.25,-.15],[xx,1.55,-.28],.025,M.steel);const m=box(xx,1.61,-.25,.56,.43,.045,M.dark,.03);m.rotation.x=-.12;box(xx,1.61,-.217,.49,.35,.008,M.teal);box(xx,1.21,.25,.44,.03,.18,M.steel,.016)}cyl(.53,1.23,.31,.11,.055,M.gold);ell(.53,1.28,.31,.10,.065,.10,M.gold);cyl(.53,1.355,.31,.025,.04,M.gold);lamp(1.22,1.20,-.06,.58);books(-1.33,1.21,.12,2)});
},[M.navy]);
// Reception wall key cabinet.
mounted('wall-key-cabinet','钥匙壁柜','wall-2',()=>{box(.86,3.07,-4.35,1.14,1.18,.33,M.wood,.04);box(.86,3.08,-4.16,.94,.93,.04,M.dark);for(let x=.44;x<1.32;x+=.22)for(let y=2.73;y<3.5;y+=.22){box(x,y,-4.12,.18,.18,.045,M.woodLight,.015);ell(x,y-.035,-4.082,.026,.026,.018,M.gold)}box(.86,3.75,-4.30,1.24,.13,.48,M.woodLight,.03)},[M.wood,M.woodLight]);
// Suit of armor on a carved base.
furnishing('armor-statue','骑士铠甲陈列','decor',()=>{
groupBuild(1.18,1.06,-2.89,0,()=>{box(0,.06,0,.76,.12,.65,M.woodLight,.035);for(let x of [-.16,.16]){ell(x,.20,.03,.105,.13,.18,M.steel);beam([x,.30,0],[x,.77,0],.071,M.steel);ell(x,.78,0,.11,.13,.12,M.steel)}ell(0,1.09,0,.28,.37,.17,M.steel);tor(0,1.32,0,.18,.042,M.gold);ell(0,1.66,0,.18,.22,.17,M.steel);box(0,1.66,.164,.26,.05,.018,M.dark);ell(0,1.87,-.01,.06,.12,.055,M.gold);for(let sg of [-1,1]){ell(sg*.31,1.28,0,.15,.15,.16,M.steel);beam([sg*.32,1.23,0],[sg*.40,.86,.1],.075,M.steel);ell(sg*.40,.83,.1,.085,.09,.08,M.steel)}ell(-.43,.77,.26,.25,.41,.055,M.steel);ell(-.43,.79,.32,.045,.045,.02,M.gold);beam([.43,.07,.18],[.43,1.07,.18],.018,M.steel);beam([.28,.95,.18],[.57,.95,.18],.023,M.gold)});
},[M.steel]);
// Two conversational yellow chairs at the center; tea and flowers on their round table.
furnishing('lobby-rug','几何纹会谈地毯','rugs',()=>rug(4.11,.06,3.14,2.49,1));
furnishing('lobby-chair-a','金色会客椅 · 左','seating',()=>sofa(3.22,-.35,.95,M.yellow,-.42),[M.yellow]);
furnishing('lobby-chair-b','金色会客椅 · 右','seating',()=>sofa(5.12,-.23,.95,M.yellow,.42),[M.yellow]);
furnishing('lobby-round-table','花束圆茶桌','tables',()=>{lathe(4.13,1.05,.71,[[0,0],[.34,0],[.36,.06],[.13,.12],[.09,.48],[.20,.57],[.48,.61],[.49,.69],[0,.69]],M.woodDark);cup(4.26,1.77,.73);pot(4.12,1.73,.68,.36)},[M.woodDark]);
// Right front couch with a chaise opposite the hearth.
furnishing('hearth-rug','炉边花纹地毯','rugs',()=>rug(3.22,3.04,4.66,2.7,0));
furnishing('hearth-sofa','暖金双人沙发','seating',()=>{sofa(2.59,2.75,2.0,M.yellow,0);pillow(2.03,2.20,2.66,M.paper,.26);pillow(3.13,2.15,2.66,M.greenLight,.24)},[M.yellow]);
furnishing('hearth-coffee','炉边下午茶茶几','tables',()=>{coffee(2.85,3.85,1.8,.75);cup(2.4,1.75,3.86);cup(3.27,1.75,3.86);books(2.94,1.75,3.78,2)},[M.wood,M.woodLight]);
furnishing('chaise','流苏贵妃椅','seating',()=>{sofa(5.65,3.20,1.88,M.cushion,-Math.PI/2);groupBuild(5.65,1.86,3.20,-Math.PI/2,()=>{box(0,0,0,1.40,.035,.70,M.teal);for(let x=-.67;x<.7;x+=.10)beam([x,.025,-.34],[x,.025,.34],.007,M.goldLight)})},[M.cushion]);
furnishing('hearth-lamp-a','炉边台灯边桌 · 左','lighting',()=>{sideTable(1.14,2.95);lamp(1.14,1.67,2.95,.83)},[M.wood,M.woodLight,M.teal]);
furnishing('hearth-lamp-b','炉边台灯边桌 · 右','lighting',()=>{sideTable(4.10,3.03);lamp(4.10,1.67,3.03,.81)},[M.wood,M.woodLight,M.teal]);
// Cream shell chair and round shag rug by the tall windows.
furnishing('shell-rug','圆形长绒地毯','rugs',()=>{
cyl(6.57,1.05,1.67,.91,.045,M.paper,.91,64);for(let i=0;i<110;i++){const a=rnd()*Math.PI*2,r=Math.sqrt(rnd())*.92;ell(6.57+Math.cos(a)*r,1.08,1.67+Math.sin(a)*r,.055,.025,.05,i%2?M.ivory:M.paper)}
},[M.ivory,M.paper]);
furnishing('shell-chair','珍珠贝壳椅','seating',()=>{
groupBuild(6.57,1.1,1.58,-.3,()=>{for(let x of [-.27,.27])for(let z of [-.20,.20])beam([x,.0,z],[x*.85,.30,z],.045,M.woodLight);ell(0,.42,0,.48,.16,.42,M.cream);for(let i=0;i<7;i++){let a=(i-3)*.26;ell(Math.sin(a)*.41,.94+Math.cos(a)*.11,-.23+Math.abs(Math.sin(a))*.16,.15,.53,.14,M.cream)}curve([[-.46,.43,.20],[-.48,.74,-.1],[0,1.51,-.25],[.48,.74,-.1],[.46,.43,.20]],.043,M.woodLight);pillow(0,.82,.015,M.pink,.22)});

},[M.cream]);
// Plants, sculpted urns and small flower bouquets.
function leaf(x,y,z,dx,dy,dz,m=M.leaf){const o=ell(x+dx*.5,y+dy*.5,z+dz*.5,.095,Math.hypot(dx,dy,dz)*.54,.042,m);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(dx,dy,dz).normalize());return o}
function flowers(x,y,z,s=.6,snow=false){for(let i=0;i<12;i++){const a=i*2.4,r=Math.sqrt(rnd())*s*.45;leaf(x,y,z,Math.cos(a)*s*.7,s*(.3+rnd()*.4),Math.sin(a)*s*.7,i%3?M.leaf:M.leafLight);if(i%2===0){const px=x+Math.cos(a)*r,py=y+s*(.57+rnd()*.33),pz=z+Math.sin(a)*r;for(let k=0;k<5;k++){let b=k*Math.PI*2/5;ell(px+Math.cos(b)*.072*s,py+Math.sin(b)*.064*s,pz,.067*s,.046*s,.028*s,i%4?M.white:M.pink)}ell(px,py,pz+.03*s,.026*s,.026*s,.024*s,M.yellow)}}if(snow)for(let i=0;i<6;i++){let a=i*1.3;ell(x+Math.cos(a)*s*.28,y+s*.64,z+Math.sin(a)*s*.28,.14*s,.06*s,.12*s,M.snow)}}
function pot(x,y,z,s=.8,urn=false,snow=false){lathe(x,y,z,urn?[[.24,0],[.30,.06],[.15,.14],[.14,.32],[.36,.45],[.46,.65],[.41,.82],[.46,.86]]:[[.23,0],[.28,.05],[.33,.43],[.37,.47],[.37,.54],[.31,.55]],M.pot,s);cyl(x,y+(urn?.83:.52)*s,z,(urn?.40:.32)*s,.04,M.soil);flowers(x,y+(urn?.84:.56)*s,z,s,snow)}
for(const [id,name,x,y,z,s]of [['plant-salon','会客厅花盆',-5.27,1.04,-.44,.84],['plant-stair','楼梯花盆',-3.48,1.04,-.41,.60],['plant-hearth','炉边花盆',.78,1.04,3.61,.88],['plant-window','窗边花盆',7.07,1.04,-1.80,.76],['plant-balcony-a','楼廊花盆 · 左',-4.88,3.93,-3.62,.49],['plant-balcony-b','楼廊花盆 · 右',-2.09,3.94,-3.78,.50]])furnishing(id,name,'plants',()=>pot(x,y,z,s),[M.pot]);
// The desk-top bouquet travels with the reception counter.
const deskStart=staticMeshes.length;pot(6.05,2.21,-2.28,.33);for(const mesh of staticMeshes.slice(deskStart)){mesh.userData.furnitureId='reception-desk';furnitureSpecs.find(item=>item.id==='reception-desk').meshes.push(mesh)}
for(const [i,x]of [-7.6,-4.30,7.57].entries())furnishing('garden-urn-'+(i+1),'庭院雪顶花盆 · '+(i+1),'plants',()=>{box(x,1.90,4.78,.63,.44,.64,M.cream,.035);pot(x,2.15,4.78,.94,true,true)},[M.pot]);
// Books and reading stand in the stair alcove.
furnishing('reading-stand','木质阅读书架','decor',()=>{
beam([-2.78,1.06,-.61],[-2.78,1.67,-.61],.06,M.woodDark);cyl(-2.78,1.08,-.61,.29,.08,M.woodDark);const stand=box(-2.78,1.78,-.59,.67,.08,.45,M.woodLight,.025);stand.rotation.x=.35;const page=box(-2.78,1.84,-.59,.54,.035,.37,M.paper);page.rotation.x=.35;

},[M.woodLight,M.woodDark]);
// Exterior stair, snowy terrace, fountain and courtyard furniture.
furnishing('stair-entrance','室外入口台阶','stairs',()=>{
for(let i=0;i<6;i++){let h=.92-i*.14,z=5.0+i*.34;box(-3.18,h/2,z,2.26,h,.45,M.cream,.02);box(-3.18,h+.016,z,1.71,.032,.44,M.red)}
for(const x of [-4.41,-1.95]){for(let i=0;i<6;i++)baluster(x,.94-i*.14,5.0+i*.34,.71,M.cream);beam([x,1.68,4.93],[x,.84,6.77],.065,M.woodLight);for(const z of [4.87,6.80]){const y=z<5?1.01:.18;box(x,y+.44,z,.27,.88,.28,M.cream);ell(x,y+.97,z,.135,.14,.135,M.gold)}}
},[M.cream,M.red,M.woodLight]);
const outdoorStart=staticMeshes.length;
// Outdoor paving uses resizable construction areas rather than individual tiles.
for(let i=0;i<70;i++){let x=-8.6+rnd()*17.2,z=4.95+rnd()*3.1;if(x>-4.6&&x<-1.75&&z<7.15)continue;if(Math.hypot(x+4.9,z-7.5)<1.6)continue;ell(x,.23,z,.3+rnd()*.5,.055+rnd()*.04,.25+rnd()*.5,M.snow)}
// Snow blankets soften every cut edge of the miniature.
for(let i=0;i<30;i++){let x=-8.3+i*.57;ell(x,.22,8.32,.49,.085,.36,M.snow)}for(let i=0;i<19;i++){let z=-5.82+i*.70;ell(-8.55,.24,z,.45,.085,.53,M.snow);ell(8.55,.24,z,.45,.09,.52,M.snow)}
outdoorMeshes.push(...staticMeshes.slice(outdoorStart).filter(m=>!m.userData.furnitureId));for(const mesh of outdoorMeshes)mesh.userData.surfaceId='outdoor';
for(let i=0;i<3;i++)furnishing('garden-shrub-'+(i+1),'积雪花灌木 · '+(i+1),'plants',()=>{const x=.35+i*1.38,z=5.72;for(let j=0;j<4;j++){let a=j*1.6;curve([[x,.17,z],[x+Math.cos(a)*.16,.55,z+Math.sin(a)*.16],[x+Math.cos(a)*.30,.91,z+Math.sin(a)*.30]],.055,M.wood)}ell(x,1.03,z,.59,.47,.54,M.leaf);flowers(x,1.12,z,.83,true);for(let j=0;j<5;j++)ell(x+(rnd()-.5)*.65,1.40+rnd()*.13,z+(rnd()-.5)*.54,.19,.07,.16,M.snow)},[M.leaf,M.leafLight]);
// Stone fountain, ice-colored water and tiered snow.
furnishing('garden-fountain','庭院石雕喷泉','decor',()=>{
cyl(-5.43,.20,7.22,1.45,.18,M.stone,1.45,64);cyl(-5.43,.35,7.22,1.22,.19,M.cream,1.22,64);cyl(-5.43,.462,7.22,1.10,.035,M.water,1.10,64);tor(-5.43,.52,7.22,1.21,.12,M.ivory);
lathe(-5.43,.48,7.22,[[.40,0],[.43,.10],[.24,.23],[.17,.58],[.30,.70],[.76,.80],[.79,.90],[.61,.95],[.29,1.0],[.16,1.25],[.28,1.37]],M.cream);ell(-5.43,1.98,7.22,.26,.24,.26,M.ivory);ell(-5.43,2.15,7.22,.26,.075,.25,M.snow);tor(-5.43,1.40,7.22,.74,.075,M.snow);for(let i=0;i<12;i++){const a=i*Math.PI/6;ell(-5.43+1.2*Math.cos(a),.63,7.22+1.2*Math.sin(a),.20,.06,.17,M.snow)}
},[M.stone,M.cream,M.ivory]);
// Park bench on the right and a snow-covered potted fir.
furnishing('garden-bench','雪中庭院长椅','seating',()=>{
groupBuild(6.75,.20,6.52,-.18,()=>{for(let xx of [-.76,.76]){beam([xx,0,-.22],[xx,.53,-.22],.04,M.dark);beam([xx,0,.22],[xx,.53,.22],.04,M.dark);beam([xx,.53,-.26],[xx,1.0,-.36],.04,M.dark)}for(let zz of [-.22,-.07,.08,.23])box(0,.54,zz,1.85,.075,.12,M.woodLight,.025);for(let y of [.77,.94])box(0,y,-.32,1.85,.14,.075,M.woodLight,.02);for(let i=0;i<5;i++)ell(-.72+i*.35,.60,0,.23,.045,.28,M.snow)});
},[M.woodLight]);
function pine(x,z,s=1){cyl(x,.52,z,.13,.7,M.wood);for(let i=0;i<4;i++){let y=.95+i*.44*s,r=(.88-i*.17)*s;const o=add(new THREE.ConeGeometry(r,.97*s,11),i%2?M.leaf:M.leafLight,x,y,z);const cap=add(new THREE.ConeGeometry(r*.89,.60*s,11),M.snow,x,y+.23*s,z)}}
furnishing('garden-pine-right','庭院雪松 · 右','plants',()=>pine(7.5,4.1,1.05),[M.leaf,M.leafLight]);
furnishing('garden-pine-left','庭院雪松 · 左','plants',()=>pine(-8.07,-4.64,1.35),[M.leaf,M.leafLight]);
function streetlamp(x,z){cyl(x,.32,z,.24,.27,M.dark);lathe(x,.45,z,[[.17,0],[.12,.16],[.07,.28],[.055,1.64],[.11,1.77]],M.dark);box(x,2.48,z,.35,.57,.35,M.glow,.035);for(let dx of [-.19,.19])for(let dz of [-.19,.19])beam([x+dx,2.18,z+dz],[x+dx,2.77,z+dz],.025,M.dark);const roof=add(new THREE.ConeGeometry(.36,.26,4),M.dark,x,2.88,z);roof.rotation.y=Math.PI/4;ell(x,3.01,z,.24,.055,.24,M.snow);ell(x,3.08,z,.07,.09,.07,M.gold);const l=new THREE.PointLight('#ffe0a1',8,4,2);l.position.set(x,2.4,z);scene.add(l);lights.push(l)}
furnishing('garden-streetlamp-left','庭院路灯 · 左','lighting',()=>streetlamp(-1.44,6.73),[M.dark]);
furnishing('garden-streetlamp-right','庭院路灯 · 右','lighting',()=>streetlamp(7.7,7.1),[M.dark]);

// Soft miniature studio lighting. The shadow plane is not part of the architecture.
const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:.13}));ground.rotation.x=-Math.PI/2;ground.position.y=-.65;ground.receiveShadow=true;scene.add(ground);
const hemi=new THREE.HemisphereLight('#e3edff','#bca082',2.15);scene.add(hemi);
const sun=new THREE.DirectionalLight('#fff0d2',3.2);sun.position.set(-7,17,12);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-15,right:15,top:15,bottom:-15,near:1,far:55});sun.shadow.bias=-.00035;sun.shadow.normalBias=.035;sun.shadow.radius=3;scene.add(sun);
const fill=new THREE.DirectionalLight('#d5e6ff',1.25);fill.position.set(10,8,-5);scene.add(fill);

// Consolidate static geometry by material: detailed scene with a small draw-call budget.
// Repeated placements and procedural flower/snow variations share one catalog
// entry. Keep their original templates and IDs for saved layouts and storage.
const catalogFamilies=[
  ['黄色花纹墙','wall-1','wall-3'],
  ['红色花纹墙','wall-2','wall-4'],
  ['矮砖墙','wall-5','wall-6','wall-7'],
  ['灯塔挂画','wall-art-2','wall-art-3','wall-art-4','wall-art-5','wall-art-6'],
  ['窗帘窗组','window-salon-a','window-salon-b'],
  ['黄铜壁灯','wall-sconce-1','wall-sconce-2','wall-sconce-3','wall-sconce-4','wall-sconce-5','wall-sconce-6'],
  ['复古扶手椅','salon-chair-a','salon-chair-b'],
  ['金色会客椅','lobby-chair-a','lobby-chair-b'],
  ['古典台灯边桌','salon-lamp-a','salon-lamp-b','hearth-lamp-a','hearth-lamp-b'],
  ['花纹地毯','salon-rug','hearth-rug'],
  ['陶盆花卉','plant-salon','plant-stair','plant-hearth','plant-window','plant-balcony-a','plant-balcony-b'],
  ['庭院花盆','garden-urn-1','garden-urn-2','garden-urn-3'],
  ['庭院花灌木','garden-shrub-1','garden-shrub-2','garden-shrub-3'],
  ['庭院雪松','garden-pine-right','garden-pine-left'],
  ['庭院路灯','garden-streetlamp-left','garden-streetlamp-right']
];
for(const [name,representative,...duplicates]of catalogFamilies){
  for(const id of [representative,...duplicates]){const spec=furnitureSpecs.find(item=>item.id===id);spec.catalogId=representative;spec.catalogName=name}
}
// Remove every original snow cap before batching or creating furniture copies.
// Keep the original anchors so existing saved furniture transforms still align.
world.updateMatrixWorld(true);
for(const spec of furnitureSpecs){
  if(spec.meshes.some(mesh=>mesh.material===M.snow)){
    const bounds=new THREE.Box3();for(const mesh of spec.meshes)bounds.expandByObject(mesh);
    spec.anchor=new THREE.Vector3((bounds.min.x+bounds.max.x)/2,bounds.min.y,(bounds.min.z+bounds.max.z)/2);
    spec.meshes=spec.meshes.filter(mesh=>mesh.material!==M.snow);
  }
  spec.name=spec.name.replace('雪中庭院','庭院').replace('积雪花灌木','庭院花灌木').replace('雪顶花盆','花盆');
}
for(let i=staticMeshes.length-1;i>=0;i--)if(staticMeshes[i].material===M.snow){staticMeshes[i].removeFromParent();staticMeshes.splice(i,1)}
for(let i=outdoorMeshes.length-1;i>=0;i--)if(outdoorMeshes[i].material===M.snow)outdoorMeshes.splice(i,1);
const catalogAudit={unassigned:staticMeshes.filter(m=>!m.userData.furnitureId&&!m.userData.roomId&&!m.userData.surfaceId).map(m=>({position:m.position.toArray(),material:m.material.name})),assemblies:furnitureSpecs.map(s=>({id:s.id,category:s.category,catalogId:s.catalogId||s.id,meshes:s.meshes.length}))};
const floorSystem=createFloorSystem({parent:world,specs:floorSpecs,mergeGeometries,anisotropy:Math.min(8,renderer.capabilities.getMaxAnisotropy())});
const furnitureSystem=createFurnitureSystem({scene,specs:furnitureSpecs,mergeGeometries,floorSystem});
const architectureSystem=createArchitectureSystem({system:furnitureSystem,foundationMeshes,outdoorMeshes,floorSystem,mergeGeometries});
furnitureSystem.setArchitecture(architectureSystem);
world.updateMatrixWorld(true);const buckets=new Map();
for(const o of staticMeshes){if(o.userData.furnitureId||o.userData.roomId||o.userData.surfaceId)continue;const g=o.geometry.clone();g.applyMatrix4(o.matrixWorld);const ng=g.index?g.toNonIndexed():g;for(const attr of Object.keys(ng.attributes))if(!['position','normal','uv'].includes(attr))ng.deleteAttribute(attr);if(!ng.attributes.uv)ng.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(ng.attributes.position.count*2),2));ng.clearGroups();const key=o.material.uuid;if(!buckets.has(key))buckets.set(key,{mat:o.material,geos:[]});buckets.get(key).geos.push(ng);world.remove(o)}
for(const {mat,geos:gs}of buckets.values()){const geo=mergeGeometries(gs,false);if(!geo)throw Error('Failed geometry batch');const mesh=new THREE.Mesh(geo,mat);mesh.castShadow=true;mesh.receiveShadow=true;world.add(mesh);gs.forEach(g=>g.dispose())}
// Fine drifting snow remains outside the open-roof rooms.
const snowBox={width:36,depth:33,bottom:.2,top:19};
const snowCount=1400,snowPos=new Float32Array(snowCount*3),snowVel=[];
for(let i=0;i<snowCount;i++){let x=(rnd()-.5)*snowBox.width,z=(rnd()-.5)*snowBox.depth;if(Math.abs(x)<8&&z<4.7&&z>-5.1){if(rnd()>.5)x=Math.sign(x||1)*(8.2+rnd()*3);else z=5.1+rnd()*5}snowPos.set([x,snowBox.bottom+rnd()*(snowBox.top-snowBox.bottom),z],i*3);snowVel.push(.22+rnd()*.5)}
const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(snowPos,3));const snowTexture=canvasTex((c,w,h)=>{const gr=c.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);gr.addColorStop(0,'#ffffff');gr.addColorStop(.35,'#ffffffe0');gr.addColorStop(1,'#ffffff00');c.fillStyle=gr;c.fillRect(0,0,w,h)},64,64);const snow=new THREE.Points(sg,new THREE.PointsMaterial({map:snowTexture,color:'#ffffff',size:.13,transparent:true,opacity:.88,depthWrite:false}));snow.visible=true;scene.add(snow);

// Camera presets and user controls.
const views={overview:{p:[18,18,24],t:[0,2.3,1]},salon:{p:[3.5,10,16],t:[-4.4,2.3,-.1]},lobby:{p:[14,10,15],t:[3.8,2,-.1]},courtyard:{p:[9,9,19],t:[-1.2,.7,6.2]},top:{p:[0,38,1],t:[0,2.3,1]}};
let tween=null,night=false,cameraView='overview';
function syncCameraView(name){
  cameraView=name==='top'?'top':'overview';const top=cameraView==='top',button=document.getElementById('camera-view-toggle');
  controls.minPolarAngle=top?0:.08;
  button.setAttribute('aria-pressed',String(top));button.setAttribute('aria-label',top?'返回原始位置':'切换到俯视');button.title=top?'返回原始位置':'切换到俯视';button.classList.toggle('active',top);
  document.getElementById('camera-view-label').textContent=top?'原始位置':'俯视';
  document.getElementById('camera-top-icon').hidden=top;document.getElementById('camera-original-icon').hidden=!top;
}
function stopCameraDrift(){
  tween=null;
  controls.autoRotate=false;toggle('rotate',false);
  // Flush OrbitControls inertia before starting a precise camera transition.
  const damping=controls.enableDamping;controls.enableDamping=false;controls.update();controls.enableDamping=damping;
}
function goView(name,instant=false){const v=views[name];stopCameraDrift();syncCameraView(name);const p=new THREE.Vector3(...v.p),t=new THREE.Vector3(...v.t);if(instant){tween=null;camera.position.copy(p);controls.target.copy(t);controls.update()}else tween={start:performance.now(),from:camera.position.clone(),fromT:controls.target.clone(),to:p,toT:t};}
goView('overview',true);
document.querySelector('#rotate').onclick=()=>{controls.autoRotate=!controls.autoRotate;toggle('rotate',controls.autoRotate)};
document.querySelector('#snow').onclick=()=>{snow.visible=!snow.visible;toggle('snow',snow.visible)};
function setLampGlow(intensity,pointIntensity){M.glow.emissiveIntensity=intensity;for(const root of [scene,...[...furnitureSystem.templates.values()].map(t=>t.root)])root.traverse(o=>{if(o.material?.userData.sourceMaterialId===M.glow.uuid)o.material.emissiveIntensity=intensity;if(o.isPointLight&&o.userData.furnitureId)o.intensity=pointIntensity})}
document.querySelector('#night').onclick=()=>{night=!night;toggle('night',night);document.body.classList.toggle('night',night);scene.background.set(night?'#233542':'#e8e5df');scene.fog.color.copy(scene.background);hemi.intensity=night?.53:2.15;sun.intensity=night?.43:3.2;fill.intensity=night?.48:1.25;renderer.toneMappingExposure=night?1.37:1.18;lights.forEach(l=>l.intensity=night?19:8);setLampGlow(night?2.1:1.15,night?19:8)};
function toggle(id,value){document.getElementById(id).classList.toggle('active',value);document.getElementById(id).setAttribute('aria-pressed',value)}
function toast(s){const el=document.querySelector('#toast');el.textContent=s;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2200)}
document.querySelector('#capture').onclick=()=>{renderer.render(scene,camera);const a=document.createElement('a');a.href=renderer.domElement.toDataURL('image/png');a.download='筑梦小屋.png';a.click();toast('已保存当前场景画面')};
createSceneMenu();
function resizeScene(){const width=Math.max(1,mount.clientWidth),height=Math.max(1,mount.clientHeight);renderer.setSize(width,height);camera.aspect=width/height;camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(35)/2)*Math.max(1,1.18/camera.aspect)));camera.updateProjectionMatrix()}
controls.addEventListener('start',()=>{tween=null});addEventListener('resize',resizeScene);
scene.updateMatrixWorld(true);
const buildingSystem=createBuildingSystem({scene,parent:world,system:furnitureSystem,floorSystem,defaultPavings:[{id:'build-paving-2001',type:'paving',x:-6.6,z:6.64,width:4.1,depth:3.26,family:'tiles',style:'stone'},{id:'build-paving-2002',type:'paving',x:3.1,z:6.64,width:10,depth:3.26,family:'tiles',style:'stone'},{id:'build-paving-2003',type:'paving',x:-3.225,z:7.645,width:2.65,depth:1.25,family:'tiles',style:'stone'}],defaultRooms:[
  {id:'build-room-1001',type:'room',x:-4,z:0,width:8,depth:10,level:1,color:'#c3b29c',floorStyle:'tile-checker',legacyFloor:'salon',roof:null},
  {id:'build-room-1002',type:'room',x:4,z:0,width:8,depth:10,level:1,color:'#c3b29c',floorStyle:'wood-long',legacyFloor:'lobby',roof:null},
  {id:'build-room-1003',type:'room',x:-4,z:-3.83,width:7.82,depth:1.84,level:2,elevation:3.9125,color:'#824920',floorStyle:'wood-long',legacyFloor:'balcony',roof:null}
]});
furnitureSystem.setConstruction(buildingSystem);
furnitureSystem.setPlacement(createPlacement({surfaces:()=>world.children,architecture:architectureSystem,floorSystem,getFurniture:()=>furnitureSystem.all()}));
furnitureSystem.setScatter(createScatterSystem({scene,system:furnitureSystem}));
const editor=createSceneEditor({scene,camera,renderer,controls,furnitureSystem,occluders:world.children,onResize:resizeScene,toast,onInteract:()=>{tween=null;controls.autoRotate=false;toggle('rotate',false)},onBuildingView:(view,room)=>{stopCameraDrift();syncCameraView('overview');const target=room?new THREE.Vector3(room.x,buildingSystem.height(room)+1,room.z):new THREE.Vector3(0,view==='2'?4:2,0),distance=room?Math.max(room.width,room.depth)*1.25:18;const to=view==='roof'?target.clone().add(new THREE.Vector3(.1,distance*1.5,1)):target.clone().add(new THREE.Vector3(distance,distance*.9,distance*1.2));tween={start:performance.now(),from:camera.position.clone(),fromT:controls.target.clone(),to,toT:target}}});
document.getElementById('camera-view-toggle').onclick=()=>{if(editor.dragging)return;editor.close();editor.builder?.close();const next=cameraView==='top'?'overview':'top';if(next==='overview')buildingSystem.setView('outside');goView(next)};
resizeScene();
let last=performance.now();function animate(now){requestAnimationFrame(animate);const dt=Math.min(.05,(now-last)/1000);last=now;const t=now*.001;buildingSystem.animate(t);if(tween){const a=Math.min(1,(now-tween.start)/1000),s=a*a*(3-2*a);camera.position.lerpVectors(tween.from,tween.to,s);controls.target.lerpVectors(tween.fromT,tween.toT,s);if(a===1)tween=null}for(const f of flames){f.mesh.scale.y=f.base*(.85+.15*Math.sin(t*9+f.phase));f.mesh.position.x+=Math.sin(t*6+f.phase)*dt*.014}firelight.intensity=(night?41:28)+Math.sin(t*10)*2;if(snow.visible){const p=sg.attributes.position;for(let i=0;i<snowCount;i++){p.array[i*3+1]-=snowVel[i]*dt;p.array[i*3]+=Math.sin(t*.35+i)*dt*.09;if(p.array[i*3]>snowBox.width/2)p.array[i*3]-=snowBox.width;if(p.array[i*3]<-snowBox.width/2)p.array[i*3]+=snowBox.width;if(p.array[i*3+1]<snowBox.bottom)p.array[i*3+1]=snowBox.top}p.needsUpdate=true}if(!editor.dragging&&controls.enabled)controls.update();editor.update();renderer.render(scene,camera)}
requestAnimationFrame(animate);document.querySelector('#loading').classList.add('done');
renderer.render(scene,camera);
window.__sceneReady=true;window.__winterScene={scene,camera,controls,renderer,views,goView,stopCameraDrift,resizeScene,editor,catalogAudit,furnitureSystem,floorSystem,architectureSystem,snow,stats:{sourceMeshes:staticMeshes.length,batches:buckets.size,furniture:furnitureSystem.all().length,triangles:renderer.info.render.triangles},setNight:()=>document.querySelector('#night').click()};
