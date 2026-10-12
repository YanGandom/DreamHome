export const OBJECT_LIMIT=200;
export function constructionCount(b={}){return ['rooms','grounds','pavings','walls','doors','decorations'].reduce((n,key)=>n+(b[key]?.length||0),0)+(b.rooms||[]).filter(r=>r.roof).length}
export function layoutCount(layout){return (layout.items||[]).filter(i=>i.visible!==false).length+constructionCount(layout.building)+(layout.scatter?.length||0)}
// Apply the same cap to imported/old saves as to live additions.
export function limitLayout(input){
  const saved=structuredClone(input);saved.items=(saved.items||[]).filter(i=>i&&typeof i==='object');let left=OBJECT_LIMIT;const b=saved.building;
  if(b&&typeof b==='object'){for(const key of ['rooms','grounds','pavings','walls','doors','decorations'])if(Array.isArray(b[key])){b[key]=b[key].filter(i=>i&&typeof i==='object').slice(0,left);left-=b[key].length}for(const r of Array.isArray(b.rooms)?b.rooms:[])if(r.roof){if(left)left--;else r.roof=null}}
  for(const item of saved.items||[])if(item.visible!==false){if(left)left--;else item.visible=false}
  if(Array.isArray(saved.scatter))saved.scatter=saved.scatter.slice(0,left);return saved;
}
export function customLayout(baseline){
  const result=structuredClone(baseline);result.items.forEach(i=>i.visible=false);result.scatter=[];result.floors={};
  result.building={version:1,height:3,componentDefaults:1,pavingDefaults:1,customGround:true,rooms:[{id:'build-room-3000',type:'room',x:0,z:0,width:6,depth:6,level:1,color:'#c3b29c',floorStyle:'wood-planks',floorRotation:0,roof:null}],grounds:[],pavings:[],walls:[],doors:[],decorations:[]};return result;
}
export function levelTasks(baseline,current){
  const before=new Map(baseline.items.map(i=>[i.id,i])),oldRooms=new Map((baseline.building?.rooms||[]).map(r=>[r.id,r])),oldPaving=new Map((baseline.building?.pavings||[]).map(r=>[r.id,r]));
  const floor=(current.building?.rooms||[]).some(r=>r.floorStyle?.startsWith('tile-')&&oldRooms.has(r.id)&&oldRooms.get(r.id).floorStyle!==r.floorStyle)||(current.building?.pavings||[]).some(p=>p.family==='tiles'&&oldPaving.has(p.id)&&oldPaving.get(p.id).style!==p.style);
  const sofa=current.items.some(i=>i.visible!==false&&!before.has(i.id)&&['salon-sofa','hearth-sofa'].includes(i.sourceId)&&Math.abs(Math.sin(i.rotation/2))>.01);
  const window=current.items.some(i=>i.visible===false&&before.get(i.id)?.visible!==false&&before.has(i.id)&&i.sourceId.startsWith('window-'));
  return [floor,sofa,window];
}
