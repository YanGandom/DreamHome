import {createLevelConfig} from './level-config.js';
import {installSettings} from './settings.js';
import {registerTranslations} from './i18n.js';
import {installProgression} from './progression-ui.js';
import {filterCustomUnlocks} from './progression.js';
import {LEVELS,makeLevelLayout,evaluateLevel} from './levels.js';
import * as THREE from './vendor/three.module.js';
import {customLayout,levelTasks} from './game-rules.js';

export const MODE_KEYS={level:'dreamhome-level-1-v1',custom:'dreamhome-custom-v1',baseline:'dreamhome-level-baseline-v1'};
function localStorageOrFallback(){try{return globalThis.localStorage}catch{return {getItem:()=>null,setItem:()=>{throw new Error('storage unavailable')}}}}
export function startGame(app,{doc=document,storage=localStorageOrFallback(),requestFrame=globalThis.requestAnimationFrame,now=()=>performance.now(),reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false}={}){
  const {camera,controls,editor,furnitureSystem:system}=app,$=id=>doc.getElementById(id),body=doc.body;
  const authored=system.initialLayout();let legacy=system.serialize();const defaultOverview=structuredClone(app.views.overview);
  const read=key=>{try{return JSON.parse(storage.getItem(key))}catch{return null}},write=(key,value)=>{try{storage.setItem(key,JSON.stringify(value))}catch{$('save-status').textContent='无法自动保存 · 请勿刷新'}};
  let baseline=read(MODE_KEYS.baseline);if(baseline?.version!==1||!Array.isArray(baseline.items)){baseline=structuredClone(legacy);write(MODE_KEYS.baseline,baseline)}
  let sceneEditing=false;let mode=null,state='intro',busy=false,orbitGeneration=0,orbiting=false;
  let levelId=1,levelBaseline=baseline,previous=system.serialize(),startingLayout=null;
  const levelConfig=createLevelConfig(storage),invalidated=new Set();let activeLevel=levelConfig.get(1);
  for(const level of levelConfig.all())if(level.names)registerTranslations(level.names.zh,[level.names.en||level.names.zh,level.names.es||level.names.zh,level.names.fr||level.names.zh]);
  const progression=installProgression(app,{doc,storage,choose,levelConfig});
  const levelKey=level=>'dreamhome-level-'+level.id+'-v1'+(level.configured||level.sceneConfigured?'-'+level.revision:'');
  const layoutKey=()=>mode==='level'?levelKey(activeLevel):MODE_KEYS.custom;
  const chrome=['achievement-toggle','editor-panel','library-collapse-toggle','camera-view-toggle','task-toggle','scene-menu-toggle','undo-edit','redo-edit','edit-mode'];
  function setChrome(enabled){for(const id of chrome)$(id).inert=!enabled;editor.setEditing(enabled);controls.enabled=enabled;body.classList.toggle('tool-rail-ready',enabled)}
  function taskPanel(open){$('task-panel').hidden=!open;$('task-toggle').setAttribute('aria-expanded',String(open));if(open)$('task-close').focus()}
  function tasks(){if(mode!=='level'||sceneEditing)return;const level=activeLevel,done=evaluateLevel(level,levelBaseline,system.serialize(),id=>system.templates.get(id)),count=done.filter(Boolean).length;
    ['task-floor','task-sofa','task-window'].forEach((id,i)=>{$(id).classList.toggle('complete',done[i]);$(id).textContent=(done[i]?'✓ ':'○ ')+level.labels[i];$(id).setAttribute('aria-label',(done[i]?'已完成：':'未完成：')+level.labels[i])});
    $('task-title').textContent='第 '+levelId+' 关 · '+level.name;$('task-chapter').textContent=level.intro;$('task-toggle').setAttribute('aria-label','第 '+levelId+' 关任务');
    $('task-count').textContent=count+'/3';$('task-progress-ring').setAttribute('stroke-dashoffset',String(100-count/3*100));$('task-status').textContent=count===3?'通关！两件奖励已解锁，可在自定义模式中使用。':level.intro;
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
  async function home(){if(busy||editor.dragging)return false;busy=true;stop();if(mode&&!sceneEditing&&!(mode==='level'&&invalidated.has(levelId)))write(layoutKey(),system.serialize());$('settings-panel').hidden=true;$('reset-confirm').hidden=true;if(sceneEditing)mode=null;sceneEditing=false;progression.setAuthoring(false);$('scene-edit-bar').hidden=true;state='intro';showEntry(false);const view=entryView();await tween(view.position,view.target,750);startOrbit();busy=false;$('dream-start').focus();return true}
  async function choose(next,requestedLevel=levelId){if(busy||!['level','custom'].includes(next))return false;if(next==='level'&&(!LEVELS[requestedLevel-1]||!sceneEditing&&!progression.levelAvailable(requestedLevel))){progression.message('请先完成上一关');return false;}busy=true;state='transition';body.dataset.gameState='transition';$('mode-level').disabled=$('mode-custom').disabled=true;$('mode-back').disabled=true;
    stop();if(mode&&!sceneEditing&&!(mode==='level'&&invalidated.has(levelId)))write(layoutKey(),system.serialize());$('game-entry').classList.add('departing');
    try{
      // A sideways camera pan carries the existing miniature off-screen before swapping layouts.
      const switching=next==='custom'||mode&&mode!==next;
      if(switching){const shift=new THREE.Vector3(75,0,0);await tween(camera.position.clone().add(shift),controls.target.clone().add(shift),650)}
      levelId=requestedLevel;const level=levelConfig.get(levelId),nextKey=sceneEditing?'dreamhome-scene-draft-v1':next==='custom'?MODE_KEYS.custom:levelKey(level);
      const fallback=next==='custom'?customLayout(authored):level.initialLayout?structuredClone(level.initialLayout):levelId===1&&!level.configured?legacy:makeLevelLayout(level,authored,progression.catalog);
      startingLayout=structuredClone(fallback);
      levelBaseline=level.initialLayout?structuredClone(level.initialLayout):levelId===1&&!level.configured?baseline:makeLevelLayout(level,authored,progression.catalog);system.levelRule=!sceneEditing&&next==='level'&&(levelId>1||level.configured)&&level.preset!=='original'?level:null;activeLevel=structuredClone(level);
      const saved=sceneEditing?null:next==='custom'?filterCustomUnlocks(read(nextKey),progression,id=>system.templates.get(id)):invalidated.has(levelId)?null:read(nextKey);invalidated.delete(levelId);editor.setStorageKey(nextKey);if(!system.loadSaved(saved)||next==='custom'&&!system.construction.state.customGround)system.load(fallback);
      system.clearHistory();previous=system.serialize();system.construction.setView('outside');mode=next;body.dataset.gameMode=mode;
      const roomScale=next==='level'&&levelId>1?Math.max(1,Math.max(level.width,level.depth)/9):1;
      app.views.overview=next==='custom'||levelId>1?{p:[11*roomScale,12*roomScale,15*roomScale],t:[0,1,0]}:structuredClone(defaultOverview);
      // Synchronize the ordinary angle toggle, then restore the animated starting pose.
      const from=camera.position.clone(),fromT=controls.target.clone();app.goView('overview',true);pose(from,fromT);
      if(switching){const to=app.views.overview;pose(new THREE.Vector3(...to.p).add(new THREE.Vector3(-75,0,0)),new THREE.Vector3(...to.t).add(new THREE.Vector3(-75,0,0)))}
      editor.setCategory('all');editor.setLibraryCollapsed(false);editor.setEditing(false);controls.enabled=false;
      body.classList.remove('game-intro');body.classList.add('game-playing');app.resizeScene();
      const view=app.views.overview;await tween(new THREE.Vector3(...view.p),new THREE.Vector3(...view.t),switching?850:1400);
      $('game-entry').hidden=true;$('game-entry').classList.remove('departing');state='playing';body.dataset.gameState='playing';$('task-toggle').hidden=sceneEditing||mode!=='level';setChrome(true);tasks();if(!sceneEditing)write(layoutKey(),system.serialize());$('camera-view-toggle').focus();return true;
    }finally{busy=false;$('mode-level').disabled=$('mode-custom').disabled=$('mode-back').disabled=false}
  }
  function reset(){if(busy||state!=='playing'||editor.dragging||!startingLayout)return false;state='resetting';editor.close(false);editor.builder.close(false);editor.setEditing(false);system.load(structuredClone(startingLayout));system.clearHistory();previous=system.serialize();state='playing';editor.setEditing(true);controls.enabled=true;app.goView('overview',true);tasks();write(sceneEditing?'dreamhome-scene-draft-v1':layoutKey(),system.serialize());$('reset-confirm').hidden=true;$('edit-mode').focus();return true}
  $('edit-mode').addEventListener('click',()=>{if(busy||state!=='playing'||editor.dragging)return;$('reset-confirm').hidden=false;$('reset-no').focus()});
  $('reset-no').addEventListener('click',()=>{$('reset-confirm').hidden=true;$('edit-mode').focus()});
  $('reset-yes').addEventListener('click',reset);
  doc.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('reset-confirm').hidden){$('reset-confirm').hidden=true;$('edit-mode').focus();e.preventDefault();e.stopImmediatePropagation()}},{capture:true});
  async function editScene(id){if(busy||editor.dragging||!progression.state.sceneUnlocked||!LEVELS[id-1])return false;
    const keep=state==='playing'&&mode==='level'&&levelId===id;
    if(!sceneEditing&&mode)write(layoutKey(),system.serialize());sceneEditing=true;progression.setAuthoring(true);
    if(!keep)await choose('level',id);else{editor.setStorageKey('dreamhome-scene-draft-v1');system.levelRule=null;taskPanel(false)}
    $('scene-edit-status').textContent='';$('task-toggle').hidden=true;$('scene-edit-bar').hidden=false;$('scene-edit-label').textContent='编辑关卡场景 · '+id;$('settings-panel').hidden=true;$('scene-config-panel').hidden=true;return true;
  }
  function saveScene(){if(!sceneEditing||busy||editor.dragging)return false;editor.close();editor.builder.close();const layout=system.serialize();activeLevel=levelConfig.setScene(levelId,layout);startingLayout=structuredClone(layout);levelBaseline=structuredClone(layout);storage.removeItem?.(levelKey(activeLevel));invalidated.add(levelId);return true}
  async function resetAll(){if(busy||editor.dragging)return false;state='resetting';editor.close(false);editor.builder.close(false);sceneEditing=false;progression.setAuthoring(false);mode=null;stop();
    const keys=[];for(let i=0;i<(storage.length||0);i++)keys.push(storage.key(i));
    for(const key of keys)if(/^dreamhome-level-\d+-v1/.test(key))storage.removeItem(key);
    for(const level of levelConfig.all()){storage.removeItem?.('dreamhome-level-'+level.id+'-v1');storage.removeItem?.(levelKey(level));invalidated.add(level.id)}
    legacy=structuredClone(authored);baseline=structuredClone(authored);write(MODE_KEYS.baseline,baseline);write('winter-grand-layout-v1',authored);editor.setStorageKey('winter-grand-layout-v1');progression.resetProgress();levelId=1;system.levelRule=null;system.load(levelConfig.get(1).initialLayout||authored);system.clearHistory();previous=system.serialize();
    for(const id of ['settings-panel','reset-all-panel','task-panel','level-picker','level-brief','reward-notice','achievement-panel','scene-edit-bar','scene-config-panel','design-panel','reset-confirm'])$(id).hidden=true;
    state='intro';showEntry(false);highView();$('dream-start').focus();return true;
  }
  $('dream-start').addEventListener('click',()=>{if(busy)return;state='modes';showEntry(true);$('mode-level').focus()});
  $('mode-back').addEventListener('click',()=>{if(!busy){state='intro';showEntry(false);$('dream-start').focus()}});
  $('mode-level').addEventListener('click',()=>progression.showLevels());$('next-level').addEventListener('click',()=>{taskPanel(false);progression.showLevels()});$('mode-custom').addEventListener('click',()=>choose('custom'));$('mode-switch').addEventListener('click',home);
  $('task-toggle').addEventListener('click',()=>taskPanel($('task-panel').hidden));$('task-close').addEventListener('click',()=>{taskPanel(false);$('task-toggle').focus()});
  doc.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('task-panel').hidden){event.preventDefault();event.stopImmediatePropagation();taskPanel(false);$('task-toggle').focus()}},{capture:true});
  system.subscribe(type=>{const current=system.serialize();if(!sceneEditing&&state==='playing'&&type==='action')progression.record(previous,current,id=>system.templates.get(id),mode==='level'?'level-'+levelId:'custom');if(['commit','restore','action'].includes(type))previous=current;if(state==='playing'&&['commit','restore'].includes(type))tasks()});
  stop();
  // The entry miniature must reflect the configured first-level design too.
  // Loading a preview does not write over any player save or designer draft.
  const entryLayout=levelConfig.get(1).initialLayout;
  if(entryLayout){system.load(structuredClone(entryLayout));system.clearHistory();previous=system.serialize()}
  showEntry();highView();$('task-toggle').hidden=true;
  const api={choose,home,reset,resetAll,editScene,saveScene,get sceneEditing(){return sceneEditing},tasks,progression,levelConfig,get levelId(){return levelId},get orbiting(){return orbiting},get mode(){return mode},get state(){return state},get busy(){return busy}};app.game=api;api.settings=installSettings(app,{doc,storage,progression,levelConfig,onConfig:id=>{invalidated.add(id)}});return api;
}
