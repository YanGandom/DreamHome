import {customLayout,levelTasks} from './game-rules.js';
import {registerTranslations} from './i18n.js';
for(const [zh,values] of Object.entries({
 '在固定的 10 × 10 米地基上搭建房间并完成布置':['Build and furnish a room on the fixed 10 × 10 m foundation.','Construye y amuebla una habitación sobre la base fija de 10 × 10 m.','Construisez et aménagez une pièce sur la fondation fixe de 10 × 10 m.'],
 '更换一处瓷砖或木地板样式':['Change a tile or wood floor style.','Cambia un diseño de baldosas o suelo de madera.','Changez un style de carrelage ou de parquet.'],
 '本关地基固定为 10 × 10 米，不能移动或调整尺寸':['This level’s 10 × 10 m foundation cannot be moved or resized.','La base de 10 × 10 m no se puede mover ni redimensionar.','La fondation de 10 × 10 m ne peut être ni déplacée ni redimensionnée.'],
 '建好 10 × 10 米地基，至少放置 3 面墙':['Build a 10 × 10 m foundation with at least 3 walls.','Construye una base de 10 × 10 m con al menos 3 paredes.','Construisez une fondation de 10 × 10 m avec au moins 3 murs.'],
 '房间内至少放置 3 个座椅和 1 张桌子':['Place at least 3 seats and 1 table in the room.','Coloca al menos 3 asientos y 1 mesa en la habitación.','Placez au moins 3 sièges et 1 table dans la pièce.'],
 '房间内至少放置 2 块地毯、3 盏灯和 2 个植物':['Place at least 2 rugs, 3 lights and 2 plants in the room.','Coloca al menos 2 alfombras, 3 lámparas y 2 plantas en la habitación.','Placez au moins 2 tapis, 3 lampes et 2 plantes dans la pièce.']
}))registerTranslations(zh,values);
const themes=[
 ['第一间小屋',6,6,2,1,0,0,'wood'],['午后阅读角',7,6,2,1,1,1,'wood'],
 ['奶油会客室',8,6,3,1,1,1,'cream'],['阳光黄小屋',8,7,3,2,1,1,'yellow'],
 ['从零筑梦',8,8,4,2,2,1,'wood'],['绿意客厅',9,8,4,2,2,2,'green'],
 ['瓷砖茶室',9,8,4,3,2,2,'tile'],['旧屋新衣',10,8,4,3,2,2,'renew'],
 ['灯火相伴',10,9,4,3,4,2,'cream'],['温暖会谈',10,10,5,3,4,2,'yellow'],
 ['庭院会客厅',11,10,5,3,4,4,'green'],['大地木语',11,10,6,4,4,3,'wood'],
 ['午后沙龙',12,10,6,4,4,3,'yellow'],['焕彩工作室',12,11,6,4,4,4,'renew'],
 ['静谧茶叙',12,12,7,4,5,4,'tile'],['森系聚会',13,12,7,4,5,5,'green'],
 ['从零造家',14,12,8,5,5,5,'wood'],['金色派对',14,13,8,5,6,5,'yellow'],
 ['全屋焕新',15,14,8,5,6,6,'renew'],['筑梦毕业展',16,14,10,6,6,6,'yellow']
];
export const LEVELS=[{id:1,name:'小屋焕新',intro:'为熟悉的小屋换个新面貌',labels:['更换一处瓷砖或木地板样式','新增双人沙发并旋转角度','删除一个原有窗户']},...themes.map(([name,width,depth,seating,tables,lighting,plants,theme],i)=>({id:i+2,name,width,depth,counts:{seating,tables,lighting,plants},theme,empty:[6,18].includes(i+2),renew:theme==='renew',intro:`地基不超过 ${width} × ${depth} 米 · 在房间内完成布置`,labels:[`建好 ${width} × ${depth} 米地基和 ${i<4?1:2} 面墙`,`${seating} 件座椅 / ${tables} 件桌柜 / ${lighting} 盏灯 / ${plants} 盆植物`,theme==='renew'?'所有原有家具更换配色，并更换全部地板花纹':theme==='yellow'?'超过 30% 的室内家具使用蜂蜜黄色':theme==='green'?'超过 30% 的室内家具使用森林绿色':theme==='cream'?'超过 30% 的室内家具使用奶油白色':theme==='tile'?'全部房间使用瓷砖地板，且旋转至少一块地板花纹':'全部房间使用木地板，并旋转至少一件座椅'],wallCount:i<4?1:2}))];
Object.assign(LEVELS[1],{width:10,depth:10,wallCount:3,freeResize:false,lockedFoundation:{id:'build-room-3000',x:0,z:0,width:10,depth:10},revision:'room10-fixed-v3',counts:{seating:3,tables:1,rugs:2,lighting:3,plants:2},intro:'在固定的 10 × 10 米地基上搭建房间并完成布置',labels:['建好 10 × 10 米地基，至少放置 3 面墙','房间内至少放置 3 个座椅和 1 张桌子','房间内至少放置 2 块地毯、3 盏灯和 2 个植物']});
export function makeLevelLayout(level,authored,catalog){
  if(level.configured?level.preset==='original':level.id===1)return structuredClone(authored);
  const out=customLayout(authored),room=out.building.rooms[0];room.width=level.width;room.depth=level.depth;
  if(level.id===2&&!level.configured)return out;
  if(level.empty){out.building.rooms=[];return out}
  // Every supplied room uses the same editable native foundation and walls as the dock.
  out.building.walls=[{id:'build-wall-3100',type:'wall',rooms:[room.id],x:0,z:-room.depth/2+.1,width:room.width,angle:0,color:'#e7d5af',style:'plaster'}];
  const categories=level.renew?['seating','tables','lighting','plants']:['seating','tables'];
  categories.forEach((category,i)=>{
    const template=catalog.find(t=>t.category===category&&t.kind==='furniture'&&!t.id.startsWith('suite-'));if(!template)return;
    out.items.push({id:`level-${level.id}-seed-${i}`,sourceId:template.sourceId,visible:true,position:[(i%2?1:-1)*Math.min(2,room.width/4),1.03,Math.floor(i/2)*2-1],rotation:0,color:null,surface:'floor-1'});
  });return out;
}
export function evaluateLevel(level,baseline,current,lookup){
  if(level.configured)return evaluateConfigured(level,baseline,current,lookup);
  if(level.id===1)return levelTasks(baseline,current);
  if(level.id===2){
    const rooms=(current.building?.rooms||[]).filter(r=>r.level===1&&Math.abs(r.width-10)<.06&&Math.abs(r.depth-10)<.06);
    const results=rooms.map(room=>{
      const items=current.items.filter(v=>v.visible!==false&&lookup(v.sourceId)?.kind==='furniture'&&v.position&&Math.abs(v.position[0]-room.x)<=room.width/2&&Math.abs(v.position[2]-room.z)<=room.depth/2&&Math.abs(v.position[1]-(room.elevation??1.02))<.6);
      const count=category=>items.filter(v=>lookup(v.sourceId)?.category===category).length;
      return[roomWallCount(room,current,lookup)>=3,count('seating')>=3&&count('tables')>=1,count('rugs')>=2&&count('lighting')>=3&&count('plants')>=2];
    });
    // All furnishings belong to the same target room, not separate foundations.
    return results.sort((a,b)=>b.filter(Boolean).length-a.filter(Boolean).length)[0]||[false,false,false];
  }
  const rooms=current.building?.rooms||[],walls=current.building?.walls||[];
  const inside=v=>rooms.some(r=>v.position&&Math.abs(v.position[0]-r.x)<=r.width/2&&Math.abs(v.position[2]-r.z)<=r.depth/2&&Math.abs(v.position[1]-(r.elevation??(r.level===2?4.22:1.02)))<.6);
  const furnishings=current.items.filter(v=>v.visible!==false&&inside(v)&&lookup(v.sourceId)?.kind==='furniture');
  const main=rooms.find(r=>r.level===1&&Math.abs(r.width-level.width)<.06&&Math.abs(r.depth-level.depth)<.06);
  const structure=!!main&&rooms.every(r=>r.width<=level.width&&r.depth<=level.depth)&&roomWallCount(main,current,lookup)>=level.wallCount;
  const content=Object.entries(level.counts).every(([cat,n])=>furnishings.filter(v=>lookup(v.sourceId)?.category===cat).length>=n);
  let style=false;const color={yellow:'#d9a449',green:'#437244',cream:'#e7d5af'}[level.theme];
  if(color)style=furnishings.length>0&&furnishings.filter(v=>v.color===color).length/furnishings.length>.3;
  else if(level.theme==='renew'){
    const original=baseline.items.filter(v=>v.visible!==false&&lookup(v.sourceId)?.kind==='furniture');
    style=original.length>0&&original.every(v=>furnishings.some(n=>n.id===v.id&&n.color&&n.color!==v.color))&&rooms.length>0&&rooms.every(r=>r.floorStyle!==(baseline.building.rooms.find(b=>b.id===r.id)?.floorStyle||'wood-planks'));
  }else if(level.theme==='tile')style=rooms.length>0&&rooms.every(r=>r.floorStyle?.startsWith('tile-'))&&rooms.some(r=>r.floorRotation%360);
  else style=rooms.length>0&&rooms.every(r=>r.floorStyle?.startsWith('wood-'))&&furnishings.some(v=>lookup(v.sourceId)?.category==='seating'&&Math.abs(v.rotation)>.01);
  return[structure,content,!!style];
}

export function evaluateConfigured(level,baseline,current,lookup){
  const rooms=current.building?.rooms||[],old=new Map(baseline.items.map(i=>[i.id,i]));
  const items=current.items.filter(v=>v.visible!==false&&lookup(v.sourceId)?.kind==='furniture'&&rooms.some(r=>v.position&&Math.abs(v.position[0]-r.x)<=r.width/2&&Math.abs(v.position[2]-r.z)<=r.depth/2&&Math.abs(v.position[1]-(r.elevation??(r.level===2?4.22:1.02)))<.6));
  return level.tasks.map(t=>{
    if(t.type==='structure'){const r=rooms.find(r=>r.level===1&&Math.abs(r.width-level.width)<.06&&Math.abs(r.depth-level.depth)<.06);return !!r&&roomWallCount(r,current,lookup)>=level.wallCount}
    if(t.type==='furnish')return Object.entries(level.counts).every(([cat,n])=>items.filter(i=>lookup(i.sourceId)?.category===cat).length>=n);
    if(t.type==='place')return items.filter(i=>!old.has(i.id)).length>=t.target;
    if(t.type==='rotate')return items.filter(i=>Math.abs(i.rotation-(old.get(i.id)?.rotation||0))>.01).length>=t.target;
    if(t.type==='lamps')return items.filter(i=>lookup(i.sourceId)?.category==='lighting').length>=t.target;
    if(t.type==='windows')return baseline.items.filter(i=>i.visible!==false&&i.sourceId.startsWith('window-')).filter(i=>!current.items.some(n=>n.id===i.id&&n.visible!==false)).length>=t.target;
    if(t.type==='newSofa')return items.filter(i=>!old.has(i.id)&&['salon-sofa','hearth-sofa'].includes(i.sourceId)&&Math.abs(i.rotation)>.01).length>=t.target;
    if(t.type==='tileChanged')return rooms.filter(r=>/^(tile|wood)-/.test(r.floorStyle||'')&&baseline.building?.rooms?.some(b=>b.id===r.id&&b.floorStyle!==r.floorStyle)).length+(current.building?.pavings||[]).filter(r=>r.family==='tiles'&&baseline.building?.pavings?.some(b=>b.id===r.id&&b.style!==r.style)).length>=t.target;
    if(['yellow','green','cream'].includes(t.type)){const color={yellow:'#d9a449',green:'#437244',cream:'#e7d5af'}[t.type];return items.length>0&&items.filter(i=>i.color===color).length/items.length>level.percent/100}
    return evaluateLevel({...level,configured:false,id:3,theme:t.type},baseline,current,lookup)[2];
  });
}
function roomWallCount(room,current,lookup){return(current.building?.walls||[]).filter(w=>w.rooms?.includes(room.id)).length+current.items.filter(i=>i.visible!==false&&lookup(i.sourceId)?.kind==='wall'&&i.position&&Math.abs(i.position[0]-room.x)<=room.width/2+.2&&Math.abs(i.position[2]-room.z)<=room.depth/2+.2&&Math.abs(i.position[1]-(room.elevation??(room.level===2?4.22:1.02)))<.65).length}
