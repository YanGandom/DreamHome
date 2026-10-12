import './check-geometry.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const {furnitureSystem:system,catalogAudit}=window.__winterScene;
const names={seating:'座椅',tables:'桌柜',lighting:'灯具',plants:'植物',rugs:'地毯',decor:'陈设',mounted:'墙饰',paving:'室外铺装',stairs:'楼梯护栏',walls:'墙体',doors:'门洞'};
assert.deepEqual(catalogAudit.unassigned,[]);
const catalog=system.catalog();for(const r of system.all())assert.ok(catalog.some(t=>t.catalogId===r.catalogId),r.id);
const control=fs.readFileSync(new URL('./building-controls.js',import.meta.url),'utf8');
const tools=JSON.parse(control.match(/const tools=(\[.*\]);/)[1].replaceAll("'",'"'));
const toolCategories={room:'地基',ground:'地基',paving:'室外铺装',garden:'室外铺装',upper:'二层地板',wall:'墙体',door:'门洞',flat:'屋顶',gable:'屋顶',chimney:'陈设'};
const rows=catalog.map(t=>({category:names[t.category],name:t.name,count:system.all().filter(r=>r.catalogId===t.catalogId).length}));
rows.push(...tools.map(([id,name])=>({category:toolCategories[id],name,count:id==='room'?2:id==='upper'?1:id==='paving'?system.construction.state.pavings.length:'—'})),...system.scatter.catalog.map(t=>({category:'道具',name:t.name,count:'—'})));
rows.sort((a,b)=>a.category.localeCompare(b.category,'zh-CN'));
const content=['# 场景组件库核对清单','',`版本：20261012-railing-finishes-1。共 ${system.all().length} 件默认可编辑模型、${system.construction.all().length} 块组件地基／楼板，组件库 ${rows.length} 个模型或道具入口。`,'','检查结果：所有场景模型均已归属组件库；未归属网格 **0**。相似模型只保留一个组件入口，原场景的配色和位置分别保存。','', '| 分类 | 组件 | 默认实例数 |','| --- | --- | ---: |',...rows.map(r=>`| ${r.category} | ${r.name} | ${r.count} |`),'','桌面茶杯、书籍、花瓶、沙发靠垫、楼梯扶手等作为所属整件模型的附件一起编辑。程序灯光、舞台阴影接收面及飘雪天气属于场景效果；雪、花瓣、树叶、彩带的可摆放版本在道具分类。','','室外铺装提供两款区域组件：四种地砖材质、四种砖边花草地材质。默认零散地砖替换为三片可调整长宽的铺装；喷洒道具支持片区选中、移动和删除。入口台阶、中央红色半高隔墙、翡翠拱门及二层地板保留。',''];
fs.writeFileSync(new URL('./CATALOG-AUDIT.md',import.meta.url),content.join('\n'));
console.log(JSON.stringify({models:system.all().length,entries:rows.length,unassigned:0,report:'CATALOG-AUDIT.md'}));
