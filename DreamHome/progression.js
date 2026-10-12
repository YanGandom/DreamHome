// Progress is separate from layouts and undo history, and shared by both modes.
import presets from './level-presets.js';
export const PROGRESS_KEY='dreamhome-progress-v1';
export const ACHIEVEMENTS=[
  ['place-5','初次安家','placements',5],['rotate-5','换个角度','rotations',5],
  ['color-5','色彩练习','colors',5],['floor-3','纹理收藏家','patterns',3],
  ['light-5','点亮小屋','lights',5],['level-3','新手设计师','levels',3],
  ['place-25','空间规划师','placements',25],['rotate-20','角度大师','rotations',20],
  ['color-20','配色达人','colors',20],['level-8','筑梦进阶','levels',8],
  ['light-15','万家灯火','lights',15],['level-15','筑梦大师','levels',15]
].map(([id,name,metric,target])=>({id,name,metric,target}));
export const METRICS={placements:'累计放置物件',rotations:'确认旋转',colors:'确认换色',patterns:'确认更换材质',lights:'累计放置灯具',levels:'完成不同关卡'};
export function createProgression({catalog,options,storage,onChange=()=>{},message=()=>{}}){
  let saved;try{saved=JSON.parse(storage.getItem(PROGRESS_KEY))}catch{}
  const valid=saved?.version===1&&Array.isArray(saved.completed)&&Array.isArray(saved.seen)&&saved.counts&&typeof saved.counts==='object';
  const state={version:1,completed:[],counts:{},seen:[],...(valid?saved:{})};
  state.completed=[...new Set(state.completed.filter(n=>Number.isInteger(n)&&n>=1&&n<=21))];
  const required=new Set(['salon-sofa','hearth-sofa','balcony-railing','stair-entrance']);
  // Keep structural tools and a starter from every category available.
  const starters=new Set(),candidates=[];
  for(const item of catalog){if(item.id.startsWith('tool-')||required.has(item.id)||!starters.has(item.category)&&!item.id.startsWith('suite-')){starters.add(item.category);continue}candidates.push(item)}
  const locked=candidates.slice().sort((a,b)=>Number(a.id.startsWith('suite-'))-Number(b.id.startsWith('suite-'))).slice(-Math.floor(catalog.length/2));
  const rewards=Array.from({length:21},(_,i)=>locked.slice(i*2,i*2+2));
  const initialRewards=rewards.map(rs=>rs.map(r=>r.id));
  if(!state.rewardIds&&presets.rewards)state.rewardIds=presets.rewards;
  if(Array.isArray(state.rewardIds)&&state.rewardIds.length===21&&state.rewardIds.every(rs=>Array.isArray(rs)&&rs.length===2)&&new Set(state.rewardIds.flat()).size===42&&state.rewardIds.flat().every(id=>locked.some(r=>r.id===id)))rewards.splice(0,21,...state.rewardIds.map(rs=>rs.map(id=>locked.find(r=>r.id===id))));
  const propLevels=new Map();const mapRewards=()=>{propLevels.clear();rewards.forEach((rs,i)=>rs.forEach(r=>propLevels.set(r.id,i+1)))};mapRewards();
  const unique=[...new Set(options)];
  // One third of all distinct finish options, never the essential yellow or baseline finishes.
  const safe=new Set(['#437244','#e7d5af','#d9a449','#c3b29c','wood-planks','tile-checker','plaster','stone','grass','#60402e']);
  const finishes=unique.filter(x=>!safe.has(x)).filter((_,i)=>i%3===2);
  for(const x of unique.slice().reverse())if(finishes.length<Math.floor(unique.length/3)&&!safe.has(x)&&!finishes.includes(x))finishes.push(x);
  finishes.splice(Math.floor(unique.length/3));
  const optionAchievements=new Map(finishes.map((x,i)=>[x,ACHIEVEMENTS[i%ACHIEVEMENTS.length]]));
  const seen=new Set(state.seen);
  function save(){state.seen=[...seen];try{storage.setItem(PROGRESS_KEY,JSON.stringify(state))}catch{message('进度无法保存，请检查浏览器存储空间')}onChange()}
  const achieved=a=>(state.counts[a.metric]||0)>=a.target;
  function allowed(id){const level=propLevels.get(id);return !!state.unlockAll||!level||state.completed.includes(level)}
  function finishAllowed(id){const a=optionAchievements.get(id);return !!state.unlockAll||!a||achieved(a)}
  function hint(id,finish=false){const a=optionAchievements.get(id);return finish&&a?`成就「${a.name}」：${METRICS[a.metric]} ${a.target} 次（${Math.min(state.counts[a.metric]||0,a.target)}/${a.target}）`: `通关第 ${propLevels.get(id)} 关后获得此道具`}
  function check(id,finish=false){const ok=finish?finishAllowed(id):allowed(id);if(!ok)message(hint(id,finish));return ok}
  function complete(id){if(!Number.isInteger(id)||id<1||id>21||state.completed.includes(id)||!state.unlockAll&&id>1&&!state.completed.includes(id-1))return false;state.completed.push(id);state.counts.levels=state.completed.length;save();return true}
  function redeem(code){if(code==='Asi'){state.unlockAll=true;save();return 'unlock'}if(code==='AsiDesign'){state.designUnlocked=true;save();return 'design'}return false}
  function setRewards(level,ids){
    if(!Number.isInteger(level)||level<1||level>21||!Array.isArray(ids)||ids.length!==2||ids[0]===ids[1]||ids.some(id=>!locked.some(r=>r.id===id)))return false;
    ids.forEach((id,slot)=>{let row,index;rewards.forEach((rs,i)=>{const j=rs.findIndex(r=>r.id===id);if(j>=0){row=i;index=j}});[rewards[level-1][slot],rewards[row][index]]=[rewards[row][index],rewards[level-1][slot]]});
    state.rewardIds=rewards.map(rs=>rs.map(r=>r.id));mapRewards();save();return true;
  }
  function record(before,after,lookup,scope){
    const prev=new Map(entities(before).map(x=>[x.id,x]));let changed=false;
    const add=(metric,key)=>{key=scope+':'+metric+':'+key;if(seen.has(key))return;seen.add(key);state.counts[metric]=(state.counts[metric]||0)+1;changed=true};
    for(const v of entities(after)){if(v.visible===false)continue;const p=prev.get(v.id),info=lookup(v.sourceId)||{};
      if(!p||p.visible===false){add('placements',v.id);if(info.category==='lighting')add('lights',v.id)}
      if(p&&p.visible!==false){if(Math.abs((p.rotation||p.angle||p.floorRotation||0)-(v.rotation||v.angle||v.floorRotation||0))>.001)add('rotations',v.id+':'+(v.rotation||v.angle||v.floorRotation));
        if(p.color!==v.color)add('colors',v.id+':'+v.color);
        if((p.floorStyle||p.style||p.wallMaterial)!==(v.floorStyle||v.style||v.wallMaterial))add('patterns',v.id+':'+(v.floorStyle||v.style||v.wallMaterial));}
    }if(changed)save();
  }
  return{state,rewards,locked,initialRewards,options:unique,finishes,optionAchievements,achieved,allowed,finishAllowed,hint,check,complete,record,redeem,setRewards,allLevelsAvailable:()=>!!state.unlockAll||Array.from({length:20},(_,i)=>i+1).every(id=>state.completed.includes(id)),levelAvailable:id=>Number.isInteger(id)&&id>=1&&id<=21&&(!!state.unlockAll||id===1||state.completed.includes(id-1))};
}
export function entities(layout){return[...(layout.items||[]),...['rooms','grounds','pavings','walls','doors','decorations'].flatMap(k=>layout.building?.[k]||[])]}
export function decorateLock(button,progress,id,finish=false){
  const locked=!!progress&&!(finish?progress.finishAllowed(id):progress.allowed(id));button.classList.toggle('reward-locked',locked);
  if(locked){button.title=progress.hint(id,finish)}
  return locked;
}

export function filterCustomUnlocks(layout,progress,lookup){
  if(!layout?.items)return layout;const result=structuredClone(layout);
  for(const item of result.items){if(!progress.allowed(lookup(item.sourceId)?.catalogId||item.sourceId))item.visible=false;if(!progress.finishAllowed(item.color))item.color=null;if(!progress.finishAllowed(item.wallMaterial))item.wallMaterial=null}
  result.scatter=(result.scatter||[]).filter(c=>progress.allowed('scatter-'+c.type));
  for(const r of result.building?.rooms||[]){if(!progress.finishAllowed(r.floorStyle))r.floorStyle='wood-planks';if(!progress.finishAllowed(r.color))r.color='#c3b29c'}
  for(const [id,style]of Object.entries(result.floors||{}))if(!progress.finishAllowed(style))result.floors[id]='wood-planks';
  for(const w of result.building?.walls||[]){if(!progress.finishAllowed(w.style))w.style='plaster';if(!progress.finishAllowed(w.color))w.color='#e7d5af'}
  for(const plot of result.building?.pavings||[])if(!progress.finishAllowed(plot.style))plot.style=plot.family==='tiles'?'stone':'grass';
  return result;
}
