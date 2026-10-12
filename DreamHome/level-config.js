import {layoutCount} from './game-rules.js';
import {LEVELS} from './levels.js';
import presets from './level-presets.js';
import {translate} from './i18n.js';
export const LEVEL_CONFIG_KEY='dreamhome-level-config-v1';
export const TASK_TYPES={structure:'建造地基和墙壁',furnish:'按数量搭配家具',wood:'木地板与旋转座椅',tile:'瓷砖地板与纹理旋转',yellow:'黄色主题',green:'绿色主题',cream:'奶油白主题',renew:'原有家具与地板全部翻新',rotate:'旋转物件',place:'新增物件',lamps:'摆放灯具',windows:'删除原有窗户',tileChanged:'更换地砖',newSofa:'新增并旋转沙发'};
export function levelDraft(level){return{width:level.width||8,depth:level.depth||10,wallCount:level.wallCount??2,counts:{seating:2,tables:1,lighting:1,plants:1,...level.counts},percent:30,preset:level.id===1?'original':level.empty?'empty':'room',names:Object.fromEntries(['zh','en','es','fr'].map(lang=>[lang,translate(level.name,lang)])),tasks:level.id===1?[{type:'tileChanged',target:1},{type:'newSofa',target:1},{type:'windows',target:1}]:[{type:'structure',target:1},{type:'furnish',target:1},{type:level.theme,target:1}]}}
export function validateLevelDraft(d){
  if(!d||typeof d!=='object'||!['original','empty','room'].includes(d.preset))throw Error('无效的初始场景');
  const number=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
  if(!number(d.width,3,20)||!number(d.depth,3,20)||!Number.isInteger(d.wallCount)||!number(d.wallCount,0,4))throw Error('地基尺寸需为 3–20 米，墙壁数量需为 0–4');
  if(!number(d.percent,0,99))throw Error('配色比例需为 0–99');
  if(!d.counts||!['seating','tables','lighting','plants'].every(k=>Number.isInteger(d.counts[k])&&number(d.counts[k],0,40))||Object.values(d.counts).reduce((a,b)=>a+b,0)>160)throw Error('家具目标总数不能超过 160');
  if(!Array.isArray(d.tasks)||d.tasks.length!==3||d.tasks.some(t=>!TASK_TYPES[t.type]||!Number.isInteger(t.target)||!number(t.target,1,100)))throw Error('需要三个有效任务，目标数量为 1–100');
  if(!d.names||!['zh','en','es','fr'].every(k=>typeof d.names[k]==='string'&&d.names[k].trim().length>0&&d.names[k].length<=80))throw Error('请填写四种语言的名称，最多 80 个字符');
  if(d.preset==='empty'&&d.tasks.some(t=>['renew','windows','tileChanged'].includes(t.type)))throw Error('空场景不能使用翻新或删除原有物件的任务');
  if(d.preset==='room'&&d.tasks.some(t=>t.type==='windows'))throw Error('删除窗户任务需要原场景');
  const valid=structuredClone(d);valid.names=Object.fromEntries(Object.entries(valid.names).map(([k,v])=>[k,v.trim()]));return valid;
}
export function configuredLabels(d){return d.tasks.map(t=>{
  if(t.type==='structure')return `建好 ${d.width} × ${d.depth} 米地基和 ${d.wallCount} 面墙`;
  if(t.type==='furnish')return `${d.counts.seating} 件座椅 / ${d.counts.tables} 件桌柜 / ${d.counts.lighting} 盏灯 / ${d.counts.plants} 盆植物`;
  if(['yellow','green','cream'].includes(t.type))return `超过 ${d.percent}% 的室内家具使用${{yellow:'蜂蜜黄色',green:'森林绿色',cream:'奶油白色'}[t.type]}`;
  if(t.type==='wood')return '全部房间使用木地板，并旋转至少一件座椅';
  if(t.type==='tile')return '全部房间使用瓷砖地板，且旋转至少一块地板花纹';
  if(t.type==='renew')return '所有原有家具更换配色，并更换全部地板花纹';
  return TASK_TYPES[t.type]+' · '+t.target;
})}
export function createLevelConfig(storage){
  let scenes=structuredClone(presets.scenes||{});
  try{const saved=JSON.parse(storage.getItem(LEVEL_CONFIG_KEY));if(saved?.version===1)scenes={...scenes,...saved.scenes}}catch{}
  function validateScene(layout){if(layout?.version!==1||!Array.isArray(layout.items)||layoutCount(layout)>200||layout.items.some(i=>!Array.isArray(i.position)||i.position.length!==3||!i.position.every(Number.isFinite)||!Number.isFinite(i.rotation)))throw Error('无效场景或超过 200 件物件');return structuredClone(layout)}
  for(const id of Object.keys(scenes))try{if(!LEVELS[+id-1])throw Error();scenes[id]=validateScene(scenes[id])}catch{delete scenes[id]}
  let overrides={};for(const [id,d]of Object.entries(presets.levels||{}))try{if(LEVELS[+id-1])overrides[id]=validateLevelDraft(d)}catch{}
  try{const saved=JSON.parse(storage.getItem(LEVEL_CONFIG_KEY));if(saved?.version===1)for(const [id,d]of Object.entries(saved.levels||{})){if(LEVELS[+id-1])overrides[id]=validateLevelDraft(d)}}catch{}
  function getBase(id){const base=LEVELS[id-1],d=overrides[id];if(!d)return base;let hash=2166136261;for(const c of JSON.stringify(d))hash=Math.imul(hash^c.charCodeAt(0),16777619);return{...base,...structuredClone(d),revision:(hash>>>0).toString(16),name:d.names.zh,configured:true,empty:d.preset==='empty',renew:d.tasks.some(t=>t.type==='renew'),labels:configuredLabels(d),intro:`地基不超过 ${d.width} × ${d.depth} 米 · 在房间内完成布置`}}
  function get(id){const level=getBase(id);if(!scenes[id])return level;let hash=2166136261;for(const c of JSON.stringify([overrides[id],scenes[id]]))hash=Math.imul(hash^c.charCodeAt(0),16777619);return{...level,initialLayout:structuredClone(scenes[id]),sceneConfigured:true,revision:(hash>>>0).toString(16)}}
  function setScene(id,layout){if(!LEVELS[id-1])throw Error('无效关卡');const next={...scenes,[id]:validateScene(layout)};storage.setItem(LEVEL_CONFIG_KEY,JSON.stringify({version:1,levels:overrides,scenes:next}));scenes=next;return get(id)}
  function set(id,d){if(!LEVELS[id-1])throw Error('无效关卡');const next={...overrides,[id]:validateLevelDraft(d)};storage.setItem(LEVEL_CONFIG_KEY,JSON.stringify({version:1,levels:next,scenes}));overrides=next;return get(id)}
  return{get,setScene,all:()=>LEVELS.map(l=>get(l.id)),draft:id=>structuredClone(overrides[id]||levelDraft(LEVELS[id-1])),set,export:()=>({version:1,levels:structuredClone(overrides),scenes:structuredClone(scenes)})};
}
