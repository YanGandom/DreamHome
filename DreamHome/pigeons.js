import * as THREE from './vendor/three.module.js';

export function createPigeons({scene,system,camera,canvas,controls,blocked=()=>false,random=Math.random,eventTarget=globalThis.window}){
  const root=new THREE.Group();root.name='CourtyardPigeons';scene.add(root);
  const sphere=new THREE.SphereGeometry(1,10,7),materials=[];
  const mat=color=>{const m=new THREE.MeshStandardMaterial({color,roughness:.8});materials.push(m);return m};
  const grey=mat('#a9b3be'),dark=mat('#525f73'),neck=mat('#55847f'),purple=mat('#77718e'),white=mat('#fff9ee'),whiteShade=mat('#e5e4dd'),eye=mat('#29272a'),feet=mat('#c58078');
  function ell(parent,name,p,s,m){const mesh=new THREE.Mesh(sphere,m);mesh.name=name;mesh.position.set(...p);mesh.scale.set(...s);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh}
  const birds=Array.from({length:4},(_,id)=>{
    const model=new THREE.Group();model.name='Pigeon-'+(id+1);model.userData.pigeonId=id;root.add(model);
    const isWhite=id>=2,plumage=isWhite?white:grey;
    const profile={speed:.34+id*.045,flap:26+id*2.7,peck:8+id*1.3,look:3.2+id*.45,pace:.7+id*.16,actions:[['peck','peck','walk','look'],['walk','walk','look','stretch'],['preen','peck','look','walk'],['look','stretch','walk','preen']][id]};
    const body=ell(model,'Body',[0,.28,0],[.19,.22,.30],plumage);
    ell(model,'Tail',[0,.25,-.29],[.13,.055,.22],isWhite?whiteShade:dark);
    const head=new THREE.Group();head.position.set(0,.40,.18);model.add(head);
    ell(head,'Neck',[0,.015,0],[.11,.16,.12],isWhite?white:id%2?purple:neck);ell(head,'Head',[0,.16,.04],[.13,.13,.14],plumage);ell(head,'Beak',[0,.13,.19],[.045,.035,.095],isWhite?feet:dark);ell(head,'Cere',[0,.15,.15],[.05,.03,.05],white);
    for(const sign of [-1,1]){ell(head,'Eye',[sign*.105,.19,.11],[.022,.023,.015],eye);ell(model,'Foot',[sign*.09,.023,.06],[.032,.022,.09],feet)}
    const wings=[-1,1].map(sign=>{const wing=new THREE.Group();wing.position.set(sign*.13,.35,0);model.add(wing);ell(wing,'Wing',[sign*.075,-.06,-.03],[.10,.14,.25],plumage);if(!isWhite)for(let i=0;i<2;i++)ell(wing,'WingStripe',[sign*.12,-.08,-.035-i*.09],[.03,.11,.025],dark);return wing});
    model.visible=false;return{id,isWhite,profile,model,body,head,wings,state:'away',next:id*.8,elapsed:0,duration:0,from:new THREE.Vector3(),to:new THREE.Vector3(),anchor:new THREE.Vector3(),nextAction:0,action:'peck',phase:random()*6};
  });
  let time=0,press=null,disposed=false,cachedBoxes=[],nextScan=0;
  function obstacles(){return [...system.all().filter(r=>r.root.visible).map(r=>new THREE.Box3().setFromObject(r.root)),...(system.construction?.wallRecords()||[]).map(r=>new THREE.Box3().setFromObject(r.root)),...(system.construction?.all()||[]).filter(r=>r.level===1).map(r=>new THREE.Box3(new THREE.Vector3(r.x-r.width/2,0,r.z-r.depth/2),new THREE.Vector3(r.x+r.width/2,2,r.z+r.depth/2)))].filter(b=>b.min.y<1&&b.max.y>.25)}
  function clear(p,boxes,except=-1){return p.x> -8.6&&p.x<8.6&&p.z> -6.1&&p.z<8.1&&!boxes.some(b=>p.x>b.min.x-.3&&p.x<b.max.x+.3&&p.z>b.min.z-.3&&p.z<b.max.z+.3)&&!birds.some(b=>b.id!==except&&b.state!=='away'&&b.anchor.distanceTo(p)<.8)}
  const frustum=new THREE.Frustum(),viewMatrix=new THREE.Matrix4();
  function inFrame(p){camera.updateMatrixWorld(true);frustum.setFromProjectionMatrix(viewMatrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));return frustum.intersectsSphere(new THREE.Sphere(p,1.2))}
  function offscreen(anchor,id){
    camera.updateMatrixWorld(true);
    const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0),direction=right.multiplyScalar(id%2?1:-1);direction.y+=.8;direction.normalize();
    let distance=Math.max(28,camera.position.distanceTo(anchor)*1.2),p=anchor.clone().addScaledVector(direction,distance);
    for(let i=0;i<16&&inFrame(p);i++){distance*=1.5;p.copy(anchor).addScaledVector(direction,distance)}
    return p;
  }
  function arrive(b){
    if(system.construction?.state.customGround){b.next=time+5;return}
    const boxes=cachedBoxes;let p=null;
    for(let i=0;i<100;i++){const candidate=new THREE.Vector3(-8.4+random()*16.8,.16,5.6+random()*2.4);if(clear(candidate,boxes,b.id)){p=candidate;break}}
    if(!p){b.next=time+5;return}
    b.anchor.copy(p);b.to.copy(p);b.from.copy(offscreen(p,b.id));b.model.position.copy(b.from);b.model.visible=true;b.state='landing';b.elapsed=0;b.duration=THREE.MathUtils.clamp(b.from.distanceTo(p)/12,2.8,6.5);b.next=time+180;
  }
  function flyAway(id){const b=birds[id];if(!b||b.state==='away'||b.state==='leaving')return false;b.state='leaving';b.elapsed=0;b.from.copy(b.model.position);b.to.copy(offscreen(b.from,b.id+1));b.duration=THREE.MathUtils.clamp(b.from.distanceTo(b.to)/15,2.2,6);return true}
  function update(dt){
    if(disposed)return;dt=Math.min(.1,Math.max(0,dt));time+=dt;if(time>=nextScan){cachedBoxes=obstacles();nextScan=time+1;}
    for(const b of birds){
      if(b.state==='away'){if(time>=b.next)arrive(b);continue}
      b.elapsed+=dt;const flying=b.state==='landing'||b.state==='leaving';
      if(flying){const u=Math.min(1,b.elapsed/b.duration),ease=u*u*(3-2*u);b.model.position.lerpVectors(b.from,b.to,ease);b.model.rotation.y=Math.atan2(b.to.x-b.from.x,b.to.z-b.from.z);b.model.rotation.x=b.state==='leaving'?-.3:.12;
        if(u===1){if(b.state==='leaving'){
          // The user may orbit or zoom while a bird flies. Never hide it while
          // its wings are still in the current view; extend its departure.
          if(inFrame(b.model.position)){b.from.copy(b.model.position);b.to.copy(offscreen(b.from,b.id+1));b.elapsed=0;b.duration=Math.max(1,b.from.distanceTo(b.to)/18)}
          else{b.state='away';b.model.visible=false}
        }else{b.state='ground';b.elapsed=0;b.duration=42+random()*18;b.nextAction=0;b.model.rotation.x=0}}
      }else{
        if(b.elapsed>b.duration){flyAway(b.id);continue}
        if(time>=b.nextAction){b.action=b.profile.actions[Math.floor(random()*b.profile.actions.length)];b.nextAction=time+b.profile.pace+random()*1.4;if(!clear(b.model.position,cachedBoxes,b.id)){flyAway(b.id);continue}b.model.rotation.y+=random()-.5}
        if(b.action==='walk'&&!blocked()){const p=b.model.position.clone().add(new THREE.Vector3(Math.sin(b.model.rotation.y)*dt*b.profile.speed,0,Math.cos(b.model.rotation.y)*dt*b.profile.speed));if(p.distanceTo(b.anchor)<.45&&clear(p,cachedBoxes,b.id))b.model.position.copy(p);else{b.action='look';b.nextAction=time+.35;b.model.rotation.y+=1.2}}
      }
      const phase=time*b.profile.flap+b.phase,stretch=!flying&&b.action==='stretch';b.wings.forEach((w,i)=>{const sign=i===0?-1:1;w.rotation.z=flying?sign*(.5+Math.sin(phase)*.9):stretch?sign*(.6+Math.sin(time*3+b.phase)*.25):0;w.scale.x=flying?2.8:stretch?1.8:1});
      const peck=!flying&&b.action==='peck',preen=!flying&&b.action==='preen',look=!flying&&b.action==='look';
      b.head.rotation.x=peck?Math.max(0,Math.sin(time*b.profile.peck+b.phase))*.85:preen?.45+Math.sin(time*7+b.phase)*.12:0;
      b.head.rotation.y=look?Math.sin(time*b.profile.look+b.phase)*.5:preen?(b.id%2?1:-1)*1.2:0;
      b.body.position.y=.28+(!flying&&b.action==='walk'?Math.sin(time*(14+b.id*2)+b.phase)*.025:0);
    }
  }
  const ray=new THREE.Raycaster();
  function pick(event){
    const r=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((event.clientX-r.left)/r.width*2-1,1-(event.clientY-r.top)/r.height*2),camera);scene.updateMatrixWorld(true);
    const visible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true};
    for(const hit of ray.intersectObjects(scene.children,true)){
      if(!hit.object.isMesh||!visible(hit.object))continue;let bird=null,helper=false;for(let o=hit.object;o;o=o.parent){if(o.userData.pigeonId!==undefined)bird=o.userData.pigeonId;if(o.userData.editorHelper)helper=true}
      if(bird!==null)return bird;if(helper||hit.object.material?.opacity===0)continue;return null;
    }return null;
  }
  const down=e=>{if(e.target!==canvas||blocked()||!controls.enabled||e.button!==0||e.isPrimary===false)return;const id=pick(e);if(id===null)return;press={id,pointer:e.pointerId,x:e.clientX,y:e.clientY,enabled:controls.enabled};controls.enabled=false;canvas.setPointerCapture(e.pointerId);e.preventDefault();e.stopImmediatePropagation()};
  function release(){if(!press)return;const p=press;press=null;controls.enabled=p.enabled;if(canvas.hasPointerCapture(p.pointer))canvas.releasePointerCapture(p.pointer)}
  const up=e=>{if(press?.pointer!==e.pointerId)return;const p=press;release();e.preventDefault();e.stopImmediatePropagation();if(Math.hypot(e.clientX-p.x,e.clientY-p.y)<12)flyAway(p.id)};
  eventTarget?.addEventListener?.('pointerdown',down,{capture:true});eventTarget?.addEventListener?.('pointerup',up,{capture:true});eventTarget?.addEventListener?.('pointercancel',release,{capture:true});eventTarget?.addEventListener?.('blur',release);
  return{root,birds,update,flyAway,pick,cycleSeconds:180,dispose(){release();disposed=true;root.removeFromParent();sphere.dispose();materials.forEach(m=>m.dispose());eventTarget?.removeEventListener?.('pointerdown',down,true);eventTarget?.removeEventListener?.('pointerup',up,true);eventTarget?.removeEventListener?.('pointercancel',release,true);eventTarget?.removeEventListener?.('blur',release)}};
}
