import * as THREE from './vendor/three.module.js';
import {SCATTER_RADIUS} from './scatter-system.js';

export function createScatterControls({scene,camera,renderer,controls,system,list,onStart,onFinish,toast}){
  const scatter=system.scatter,meter=document.getElementById('scatter-meter'),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const ring=new THREE.Mesh(new THREE.RingGeometry(SCATTER_RADIUS-.035,SCATTER_RADIUS,48),new THREE.MeshBasicMaterial({color:'#7bac63',transparent:true,opacity:.8,depthWrite:false,side:THREE.DoubleSide}));
  ring.name='ScatterBrush';ring.rotation.x=-Math.PI/2;ring.visible=false;scene.add(ring);
  let drag=null,suppressClick=false;
  function hide(){ring.visible=false;meter.hidden=true}
  function locate(){
    const rect=renderer.domElement.getBoundingClientRect(),{clientX:x,clientY:y}=drag.event;
    if(x<rect.left||y<rect.top||x>=rect.left+rect.width||y>=rect.top+rect.height)return null;
    pointer.set((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2);camera.updateMatrixWorld(true);raycaster.setFromCamera(pointer,camera);return scatter.pick(raycaster);
  }
  function sample(now){
    if(!drag?.painting)return;
    const dt=Math.max(0,(now-drag.last)/1000);drag.last=now;
    const point=locate();if(!point){drag.previous=null;hide();return}
    scatter.stroke(drag.type,drag.previous,point,dt);drag.previous=point.clone();
    ring.position.copy(point);ring.position.y+=.18;ring.visible=true;
    const level=scatter.levelAt(drag.type,point);meter.hidden=false;meter.dataset.level=String(level);meter.setAttribute('aria-label',`${drag.name} · 第 ${level} 层，共 3 层`);
    const rect=renderer.domElement.getBoundingClientRect();meter.style.left=Math.min(rect.left+rect.width-66,Math.max(rect.left+6,drag.event.clientX-28))+'px';meter.style.top=Math.max(rect.top+8,drag.event.clientY-66)+'px';
  }
  function move(event){
    if(!drag||event.pointerId!==drag.pointerId)return;
    drag.event=event;
    if(!drag.moved&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<7)return;
    const rect=renderer.domElement.getBoundingClientRect(),inStage=event.clientY<rect.top+rect.height;
    if(drag.scrolling||!drag.moved&&!inStage&&Math.abs(event.clientX-drag.x)>Math.abs(event.clientY-drag.y)*1.3){drag.moved=true;drag.scrolling=true;list.scrollLeft=drag.scrollLeft-(event.clientX-drag.x);return}
    event.preventDefault();event.stopImmediatePropagation();
    if(!drag.painting){drag.moved=true;drag.painting=true;onStart();scene.updateMatrixWorld(true);scatter.refresh();system.beginGesture();scatter.beginStroke();controls.enabled=false;document.body.classList.add('scatter-painting');drag.last=performance.now()-60;sample(performance.now())}
    else if(!locate()){drag.previous=null;hide()}
  }
  function finish(commit){
    if(!drag)return;const state=drag;drag=null;suppressClick=state.moved;
    hide();document.body.classList.remove('scatter-painting');
    if(state.painting){scatter.endStroke();controls.enabled=state.controlsEnabled;if(commit)system.commitGesture();else system.cancelGesture();if(commit&&scatter.full)toast('这片庭院已经铺满了道具')}
    if(list.hasPointerCapture(state.pointerId))list.releasePointerCapture(state.pointerId);
    onFinish();
  }
  function bindCard(card,record){
    card.addEventListener('pointerdown',event=>{if(event.button!==0||event.isPrimary===false||drag)return;suppressClick=false;drag={type:record.scatterType,name:record.name,pointerId:event.pointerId,x:event.clientX,y:event.clientY,event,moved:false,painting:false,scrolling:false,scrollLeft:list.scrollLeft||0,previous:null,controlsEnabled:controls.enabled};list.setPointerCapture(event.pointerId)});
    card.addEventListener('dragstart',event=>event.preventDefault());
    card.addEventListener('click',()=>{if(suppressClick){suppressClick=false;return}toast('将'+record.name+'拖到室外地面，按住撒落；停留越久越厚，最多三层')});
  }
  window.addEventListener('pointermove',move,{capture:true});
  window.addEventListener('pointerup',event=>{if(event.pointerId!==drag?.pointerId)return;if(drag.painting){event.preventDefault();event.stopImmediatePropagation();drag.event=event;sample(performance.now())}finish(true)},{capture:true});
  window.addEventListener('pointercancel',event=>{if(event.pointerId===drag?.pointerId)finish(false)},{capture:true});
  list.addEventListener('lostpointercapture',()=>finish(false));
  window.addEventListener('blur',()=>finish(false));
  window.addEventListener('keydown',event=>{if(!drag)return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();finish(false)}else if((event.ctrlKey||event.metaKey)&&['z','y'].includes(event.key.toLowerCase()))finish(false)},{capture:true});
  return{bindCard,cancel:()=>finish(false),update:(now=performance.now())=>{if(drag?.painting&&now-drag.last>=80)sample(now)},get dragging(){return!!drag},get painting(){return!!drag?.painting}};
}
