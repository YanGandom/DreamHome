import {createProgression,ACHIEVEMENTS,METRICS} from './progression.js';
import {LEVELS} from './levels.js';

export function installProgression(app,{doc,storage,choose,levelConfig={get:id=>LEVELS[id-1],all:()=>LEVELS}}){
  const system=app.furnitureSystem,$=id=>doc.getElementById(id),make=(tag,text)=>{const el=doc.createElement(tag);el.textContent=text;return el};
  system.addRewardSuites();
  const catalog=[...system.catalog(),...(app.editor.builder.catalog||[]),...(system.scatter?.catalog||[])];
  const options=['#437244','#e7d5af','#d9a449','#963d43','#638b9c','#c58b91','#60402e','#c49a62','#f4f1e8','#902e42',...system.construction.colors,...system.construction.foundationColors,...system.floorSystem.styles.map(s=>s.id),...system.architecture.styles.map(s=>s.id),...system.construction.outdoorStyles.map(s=>s.id)];
  function message(text){$('reward-notice-text').textContent=text;$('reward-notice').hidden=false;$('reward-notice-close').focus()}
  const progress=createProgression({catalog,options,storage,message,onChange:()=>{app.editor.refreshLibrary?.();renderAchievements();renderLevels()}});
  system.progression=progress;
  const lookup=id=>system.templates.get(id),key=id=>lookup(id)?.catalogId||system.get(id)?.catalogId||id;
  const wrap=(object,name,gate)=>{const original=object?.[name];if(!original)return;object[name]=(...args)=>gate(...args)?original(...args):false};
  wrap(system,'add',id=>progress.check(key(id)));wrap(system,'restore',id=>progress.check(key(id)));
  wrap(system,'beginPlacement',id=>progress.check(key(id)));
  for(const method of ['colorPreview','setColor','floorPreview','materialPreview'])wrap(system,method,(_,value)=>progress.check(value,true));
  const b=system.construction;
  for(const [method,tool]of Object.entries({addRoom:'room',addUpper:'upper',addGround:'ground',addWall:'wall',addStackedWall:'wall',addDoor:'door',addDecoration:'chimney'}))wrap(b,method,()=>progress.check('tool-'+tool));
  wrap(b,'addPaving',(_,family)=>progress.check('tool-'+(family==='garden'?'garden':'paving')));
  wrap(b,'setRoof',(_,style)=>progress.check('tool-'+style));
  wrap(b,'color',(_,color)=>progress.check(color,true));wrap(b,'setStyle',(_,style)=>progress.check(style,true));
  for(const method of ['paint','stroke'])wrap(system.scatter,method,type=>progress.check('scatter-'+type));
  function renderLevels(){const list=$('level-list');list.replaceChildren();for(const level of levelConfig.all()){const unlocked=progress.levelAvailable(level.id),button=make('button',`${level.id}. ${level.name}${progress.state.completed.includes(level.id)?' ✓':unlocked?'':' 🔒'}`);button.type='button';button.className='level-card'+(unlocked?'':' reward-locked');button.append(make('small',level.intro));button.append(make('small','奖励：'+progress.rewards[level.id-1].map(r=>r.name).join('、')));button.addEventListener('click',()=>{if(!unlocked){message(`请先完成第 ${level.id-1} 关`);return}$('level-picker').hidden=true;showBrief(level.id)});list.append(button)}}
  let briefId=1;
  function showBrief(id){briefId=id;const level=levelConfig.get(id);$('level-brief-title').textContent=`第 ${id} 关 · ${level.name}`;$('level-brief-tasks').replaceChildren(...level.labels.map(label=>make('li',label)));$('level-brief-rewards').replaceChildren(...progress.rewards[id-1].map(r=>{const item=make('div','');item.className='brief-reward';const image=make('img','');image.alt=r.name;image.draggable=false;item.append(image,make('span',r.name));app.editor.previewThumbnail?.(r,image);return item}));$('level-brief').hidden=false;$('level-brief-start').focus()}
  function showLevels(){if(!progress.allLevelsAvailable()){const id=LEVELS.find(l=>!progress.state.completed.includes(l.id))?.id||21;showBrief(id);return}renderLevels();$('level-picker').hidden=false;$('level-picker-close').focus()}
  $('level-brief-close').addEventListener('click',()=>{$('level-brief').hidden=true;$('mode-level').focus()});
  $('level-brief-start').addEventListener('click',async()=>{if($('level-brief-start').disabled)return;$('level-brief-start').disabled=true;try{$('level-brief').hidden=true;await choose('level',briefId)}finally{$('level-brief-start').disabled=false}});
  function renderAchievements(){const list=$('achievement-list');list.replaceChildren();for(const a of ACHIEVEMENTS){const row=make('article','');row.className='achievement-card';const n=Math.min(progress.state.counts[a.metric]||0,a.target);row.append(make('h3',a.name+(progress.achieved(a)?' ✓':' 🔒')));row.append(make('p',`${METRICS[a.metric]}：${n} / ${a.target}`));const finishes=[...progress.optionAchievements].filter(([,v])=>v.id===a.id).map(([id])=>id);row.append(make('small','奖励：'+finishes.map(id=>system.floorSystem.styles.find(s=>s.id===id)?.name||system.architecture.styles.find(s=>s.id===id)?.name||system.construction.outdoorStyles.find(s=>s.id===id)?.name||({'#437244':'森林绿','#e7d5af':'奶油白','#d9a449':'蜂蜜黄','#963d43':'酒红','#638b9c':'雾蓝','#c58b91':'玫瑰粉','#60402e':'胡桃木','#c49a62':'原木','#f4f1e8':'白木','#902e42':'复古红'}[id])||'专属配色').join('、')));list.append(row)}}
  $('achievement-toggle').addEventListener('click',()=>{renderAchievements();$('achievement-panel').hidden=false;$('achievement-close').focus()});
  $('achievement-close').addEventListener('click',()=>{$('achievement-panel').hidden=true;$('achievement-toggle').focus()});
  $('reward-notice-close').addEventListener('click',()=>{$('reward-notice').hidden=true});
  $('level-picker-close').addEventListener('click',()=>{$('level-picker').hidden=true;$('mode-level').focus()});
  doc.addEventListener('keydown',e=>{if(e.key==='Escape')for(const id of ['reward-notice','achievement-panel','level-brief','level-picker']){if(!$(id).hidden){$(id).hidden=true;e.preventDefault();e.stopImmediatePropagation();break}}},{capture:true});
  renderLevels();renderAchievements();app.editor.refreshLibrary?.();
  return{...progress,catalog,message,showBrief,showLevels};
}
