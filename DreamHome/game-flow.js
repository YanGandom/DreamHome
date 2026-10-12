import {installProgression} from './progression-ui.js';
import {filterCustomUnlocks} from './progression.js';
import {LEVELS,makeLevelLayout,evaluateLevel} from './levels.js';
import * as THREE from './vendor/three.module.js';
import {customLayout,levelTasks} from './game-rules.js';

export const MODE_KEYS={level:'dreamhome-level-1-v1',custom:'dreamhome-custom-v1',baseline:'dreamhome-level-baseline-v1'};
function localStorageOrFallback(){try{return globalThis.localStorage}catch{return {getItem:()=>null,setItem:()=>{throw new Error('storage unavailable')}}}}
export function startGame(app,{doc=document,storage=localStorageOrFallback(),requestFrame=globalThis.requestAnimationFrame,now=()=>performance.now(),reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false}={}){
  const {camera,controls,editor,furnitureSystem:system}=app,$=id=>doc.getElementById(id),body=doc.body;
  const authored=system.initialLayout(),legacy=system.serialize(),defaultOverview=structuredClone(app.views.overview);
  const read=key=>{try{return JSON.parse(storage.getItem(key))}catch{return null}},write=(key,value)=>{try{storage.setItem(key,JSON.stringify(value))}catch{$('save-status').textContent='无法自动保存 · 请勿刷新'}};
  let baseline=read(MODE_KEYS.baseline);if(baseline?.version!==1||!Array.isArray(baseline.items)){baseline=structuredClone(legacy);write(MODE_KEYS.baseline,baseline)}
  let mode=null,state='intro',busy=false,orbitGeneration=0,orbiting=false;
  let levelId=1,levelBaseline=baseline,previous=system.serialize();
  const progression=installProgression(app,{doc,storage,choose});
  const layoutKey=()=>mode==='level'?(levelId===1?MODE_KEYS.level:'dreamhome-level-'+levelId+'-v1'):MODE_KEYS.custom;
  const chrome=['achievement-toggle','editor-panel','library-collapse-toggle','camera-view-toggle','task-toggle','mode-switch','scene-menu-toggle','undo-edit','redo-edit','edit-mode'];
  function setChrome(enabled){for(const id of chrome)$(id).inert=!enabled;editor.setEditing(enabled);controls.enabled=enabled}
  function taskPanel(open){$('task-panel').hidden=!open;$('task-toggle').setAttribute('aria-expanded',String(open));if(open)$('task-close').focus()}
  function tasks(){if(mode!=='level')return;const level=LEVELS[levelId-1],done=evaluateLevel(level,levelBaseline,system.serialize(),id=>system.templates.get(id)),count=done.filter(Boolean).length;
    ['task-floor','task-sofa','task-window'].forEach((id,i)=>{$(id).classList.toggle('complete',done[i]);$(id).textContent=(done[i]?'✓ ':'○ ')+level.labels[i];$(id).setAttribute('aria-label',(done[i]?'已完成：':'未完成：')+level.labels[i])});
    $('task-title').textContent='第 '+levelId+' 关 · '+level.name;$('task-chapter').textContent=level.intro;$('task-toggle').setAttribute('aria-label','第 '+levelId+' 关任务');
    $('task-count').textContent=count+'/3';$('task-status').textContent=count===3?'通关！两件奖励已解锁，可在自定义模式中使用。':level.intro;
    $('next-level').hidden=!progression.state.completed.includes(levelId)&&count!==3;
    if(count===3&&state==='playing'&&!system.gesturing&&progression.complete(levelId)){progression.message('第 '+levelId+' 关完成！获得：'+progression.rewards[levelId-1].map(r=>r.name).join('、'));}
  }
  function pose(position,target){camera.position.copy(position);controls.target.copy(target);camera.lookAt(target);camera.updateMatrixWorld(true)}
  function tween(position,target,duration){const p=camera.position.clone(),t=controls.target.clone(),start=now(),ms=reducedMotion?0:duration;
    return new Promise(resolve=>{function frame(time){const a=ms?Math.min(1,Math.max(0,(time-start)/ms)):1,s=a*a*(3-2*a);pose(p.clone().lerp(position,s),t.clone().lerp(target,s));if(a<1)requestFrame(frame);else resolve()}requestFrame(frame)});
  }
  function stopOrbit(){orbitGeneration++;orbiting=false}
  function startOrbit(){
    stopOrbit();if(reducedMotion)return;orbiting=true;const generation=orbitGeneration,center=controls.target.clone(),offset=camera.position.clone().sub(center),radius=Math.hypot(offset.x,offset.z);let angle=Math.atan2(offset.x,offset.z),last=now();
    function frame(time){if(generation!==orbitGeneration)return;const dt=Math.min(.05,Math.max(0,(time-last)/1000));last=time;angle+=dt*.10;pose(center.clone().add(new THREE.Vector3(Math.sin(angle)*radius,offset.y,Math.cos(angle)*radius)),center);requestFrame(frame)}requestFrame(frame);
  }
  function stop(){stopOrbit();app.stopCameraDrift();editor.close();editor.builder.close();taskPanel(false);setChrome(false);$('scene-menu').hidden=true;$('scene-menu-toggle').setAttribute('aria-expanded','false')}
  function showEntry(modes=false){body.classList.add('game-intro');body.classList.remove('game-playing');body.dataset.gameState=modes?'modes':'intro';$('game-entry').hidden=false;$('dream-start').hidden=modes;$('mode-panel').hidden=!modes;app.resizeScene()}
  function entryView(){const target=new THREE.Vector3(...defaultOverview.t),direction=new THREE.Vector3(...defaultOverview.p).sub(target).normalize();return{target,position:target.clone().addScaledVector(direction,controls.maxDistance||44)}}
  function highView(){const view=entryView();pose(view.position,view.target);startOrbit()}
  async function home(){if(busy||editor.dragging)return false;busy=true;stop();if(mode)write(layoutKey(),system.serialize());state='modes';showEntry(true);const view=entryView();await tween(view.position,view.target,750);startOrbit();busy=false;$('mode-level').focus();return true}
  async function choose(next,requestedLevel=levelId){if(busy||!['level','custom'].includes(next))return false;if(next==='level'&&(!LEVELS[requestedLevel-1]||!progression.levelAvailable(requestedLevel))){progression.message('请先完成上一关');return false;}busy=true;state='transition';body.dataset.gameState='transition';$('mode-level').disabled=$('mode-custom').disabled=true;$('mode-back').disabled=true;
    stop();if(mode)write(layoutKey(),system.serialize());$('game-entry').classList.add('departing');
    try{
      // A sideways camera pan carries the existing miniature off-screen before swapping layouts.
      const switching=next==='custom'||mode&&mode!==next;
      if(switching){const shift=new THREE.Vector3(75,0,0);await tween(camera.position.clone().add(shift),controls.target.clone().add(shift),650)}
      levelId=requestedLevel;const level=LEVELS[levelId-1],nextKey=next==='custom'?MODE_KEYS.custom:levelId===1?MODE_KEYS.level:'dreamhome-level-'+levelId+'-v1';
      const fallback=next==='custom'?customLayout(authored):levelId===1?legacy:makeLevelLayout(level,authored,progression.catalog);
      levelBaseline=levelId===1?baseline:makeLevelLayout(level,authored,progression.catalog);system.levelRule=next==='level'&&levelId>1?level:null;
      const saved=next==='custom'?filterCustomUnlocks(read(nextKey),progression,id=>system.templates.get(id)):read(nextKey);editor.setStorageKey(nextKey);if(!system.loadSaved(saved)||next==='custom'&&!system.construction.state.customGround)system.load(fallback);
      system.clearHistory();previous=system.serialize();system.construction.setView('outside');mode=next;body.dataset.gameMode=mode;
      const roomScale=next==='level'&&levelId>1?Math.max(1,Math.max(level.width,level.depth)/9):1;
      app.views.overview=next==='custom'||levelId>1?{p:[11*roomScale,12*roomScale,15*roomScale],t:[0,1,0]}:structuredClone(defaultOverview);
      // Synchronize the ordinary angle toggle, then restore the animated starting pose.
      const from=camera.position.clone(),fromT=controls.target.clone();app.goView('overview',true);pose(from,fromT);
      if(switching){const to=app.views.overview;pose(new THREE.Vector3(...to.p).add(new THREE.Vector3(-75,0,0)),new THREE.Vector3(...to.t).add(new THREE.Vector3(-75,0,0)))}
      editor.setCategory('all');editor.setLibraryCollapsed(false);editor.setEditing(false);controls.enabled=false;
      body.classList.remove('game-intro');body.classList.add('game-playing');app.resizeScene();
      const view=app.views.overview;await tween(new THREE.Vector3(...view.p),new THREE.Vector3(...view.t),switching?850:1400);
      $('game-entry').hidden=true;$('game-entry').classList.remove('departing');state='playing';body.dataset.gameState='playing';setChrome(true);$('task-toggle').hidden=mode!=='level';tasks();write(layoutKey(),system.serialize());$('mode-switch').focus();return true;
    }finally{busy=false;$('mode-level').disabled=$('mode-custom').disabled=$('mode-back').disabled=false}
  }
  $('dream-start').addEventListener('click',()=>{if(busy)return;state='modes';showEntry(true);$('mode-level').focus()});
  $('mode-back').addEventListener('click',()=>{if(!busy){state='intro';showEntry(false);$('dream-start').focus()}});
  $('mode-level').addEventListener('click',()=>progression.showLevels());$('next-level').addEventListener('click',()=>{taskPanel(false);progression.showLevels()});$('mode-custom').addEventListener('click',()=>choose('custom'));$('mode-switch').addEventListener('click',home);
  $('task-toggle').addEventListener('click',()=>taskPanel($('task-panel').hidden));$('task-close').addEventListener('click',()=>{taskPanel(false);$('task-toggle').focus()});
  doc.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('task-panel').hidden){event.preventDefault();event.stopImmediatePropagation();taskPanel(false);$('task-toggle').focus()}},{capture:true});
  system.subscribe(type=>{const current=system.serialize();if(state==='playing'&&type==='action')progression.record(previous,current,id=>system.templates.get(id),mode==='level'?'level-'+levelId:'custom');if(['commit','restore','action'].includes(type))previous=current;if(state==='playing'&&['commit','restore'].includes(type))tasks()});
  stop();showEntry();highView();$('task-toggle').hidden=true;
  const api={choose,home,tasks,progression,get levelId(){return levelId},get orbiting(){return orbiting},get mode(){return mode},get state(){return state},get busy(){return busy}};app.game=api;return api;
}
