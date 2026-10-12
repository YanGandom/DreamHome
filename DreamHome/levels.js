import {customLayout,levelTasks} from './game-rules.js';
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
export const LEVELS=[{id:1,name:'小屋焕新',intro:'为熟悉的小屋换个新面貌',labels:['更换一处地砖样式','新增双人沙发并旋转角度','删除一个原有窗户']},...themes.map(([name,width,depth,seating,tables,lighting,plants,theme],i)=>({id:i+2,name,width,depth,counts:{seating,tables,lighting,plants},theme,empty:[6,18].includes(i+2),renew:theme==='renew',intro:`地基不超过 ${width} × ${depth} 米 · 在房间内完成布置`,labels:[`建好 ${width} × ${depth} 米地基和 ${i<4?1:2} 面墙`,`${seating} 件座椅 / ${tables} 件桌柜 / ${lighting} 盏灯 / ${plants} 盆植物`,theme==='renew'?'所有原有家具更换配色，并更换全部地板花纹':theme==='yellow'?'超过 30% 的室内家具使用蜂蜜黄色':theme==='green'?'超过 30% 的室内家具使用森林绿色':theme==='cream'?'超过 30% 的室内家具使用奶油白色':theme==='tile'?'全部房间使用瓷砖地板，且旋转至少一块地板花纹':'全部房间使用木地板，并旋转至少一件座椅'],wallCount:i<4?1:2}))];
export function makeLevelLayout(level,authored,catalog){
  if(level.id===1)return structuredClone(authored);
  const out=customLayout(authored),room=out.building.rooms[0];room.width=level.width;room.depth=level.depth;
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
  if(level.id===1)return levelTasks(baseline,current);
  const rooms=current.building?.rooms||[],walls=current.building?.walls||[];
  const inside=v=>rooms.some(r=>v.position&&Math.abs(v.position[0]-r.x)<=r.width/2&&Math.abs(v.position[2]-r.z)<=r.depth/2&&Math.abs(v.position[1]-(r.elevation??(r.level===2?4.22:1.02)))<.6);
  const furnishings=current.items.filter(v=>v.visible!==false&&inside(v)&&lookup(v.sourceId)?.kind==='furniture');
  const main=rooms.find(r=>r.level===1&&Math.abs(r.width-level.width)<.06&&Math.abs(r.depth-level.depth)<.06);
  const structure=!!main&&rooms.every(r=>r.width<=level.width&&r.depth<=level.depth)&&walls.filter(w=>w.rooms?.includes(main.id)).length>=level.wallCount;
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
