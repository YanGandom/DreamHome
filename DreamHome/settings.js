import {createGameAudio} from './game-audio.js';
import {TASK_TYPES} from './level-config.js';
import {getLanguage,setLanguage,registerTranslations} from './i18n.js';

export const SETTINGS_KEY='dreamhome-settings-v1';
export function installSettings(app,{doc,storage,progression,levelConfig,onConfig=()=>{}}){
  const $=id=>doc.getElementById(id);let saved;try{saved=JSON.parse(storage.getItem(SETTINGS_KEY))}catch{}
  const settings={music:saved?.music!==false,effects:saved?.effects!==false};
  const audio=createGameAudio({...settings,doc});let selected=1;
  const message=text=>{$('settings-status').textContent=text};
  function save(){try{storage.setItem(SETTINGS_KEY,JSON.stringify(settings))}catch{message('设置保存失败')}}
  function render(){for(const key of ['music','effects']){$('settings-'+key).setAttribute('aria-pressed',String(settings[key]));$('settings-'+key).textContent=settings[key]?'开启':'关闭'}$('settings-language').value=getLanguage();$('settings-design').hidden=!progression.state.designUnlocked}
  $('settings-toggle').addEventListener('click',()=>{if(app.game?.busy)return;render();$('settings-panel').hidden=false;$('settings-close').focus()});
  $('settings-close').addEventListener('click',()=>{$('settings-panel').hidden=true;$('settings-toggle').focus()});
  for(const key of ['music','effects'])$('settings-'+key).addEventListener('click',()=>{settings[key]=!settings[key];audio.set(settings.music,settings.effects);save();render()});
  $('settings-language').addEventListener('change',()=>{setLanguage($('settings-language').value);render()});
  $('settings-code-form').addEventListener('submit',e=>{e.preventDefault();const result=progression.redeem($('settings-code').value.trim());$('settings-code').value='';message(result==='unlock'?'所有道具、配色和关卡已解锁':result==='design'?'关卡配置已开启':'代码无效');render();if(result==='design')openDesigner()});
  function option(value,text){const o=doc.createElement('option');o.value=value;o.textContent=text;return o}
  function field(id,value){$(id).value=String(value)}
  function targetState(i){$('design-target-'+i).disabled=!['rotate','place','lamps','windows','tileChanged','newSofa'].includes($('design-task-'+i).value)}
  function fill(){const d=levelConfig.draft(selected);for(const lang of ['zh','en','es','fr'])field('design-name-'+lang,d.names[lang]);for(const key of ['width','depth','wallCount','percent','preset'])field('design-'+key,d[key]);for(const key of ['seating','tables','lighting','plants'])field('design-'+key,d.counts[key]);d.tasks.forEach((task,i)=>{field('design-task-'+i,task.type);field('design-target-'+i,task.target);targetState(i)});progression.rewards[selected-1].forEach((r,i)=>field('design-reward-'+i,r.id));$('design-status').textContent=''}
  function openDesigner(){if(!progression.state.designUnlocked)return;$('settings-panel').hidden=true;$('design-panel').hidden=false;fill();$('design-close').focus()}
  for(const level of levelConfig.all())$('design-level').append(option(level.id,`${level.id}. ${level.name}`));
  for(let i=0;i<3;i++)for(const [id,label]of Object.entries(TASK_TYPES))$('design-task-'+i).append(option(id,label));
  for(let i=0;i<3;i++)$('design-task-'+i).addEventListener('change',()=>targetState(i));
  for(let i=0;i<2;i++)for(const r of progression.locked)$('design-reward-'+i).append(option(r.id,r.name));
  $('design-level').addEventListener('change',()=>{selected=Number($('design-level').value);fill()});
  $('settings-design').addEventListener('click',openDesigner);
  $('design-close').addEventListener('click',()=>{$('design-panel').hidden=true;$('settings-panel').hidden=false;$('settings-close').focus()});
  $('design-export').addEventListener('click',()=>{if(!progression.state.designUnlocked)return;const config={...levelConfig.export(),rewards:progression.rewards.map(rs=>rs.map(r=>r.id))},url=URL.createObjectURL(new Blob(['export default '+JSON.stringify(config,null,2)+';\n'],{type:'text/javascript'})),link=doc.createElement('a');link.href=url;link.download='level-presets.js';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('design-status').textContent='配置已导出，将文件覆盖到项目根目录即可发布'});
  $('design-form').addEventListener('submit',e=>{
    e.preventDefault();if(!progression.state.designUnlocked)return;
    try{
      const rewards=[0,1].map(i=>$('design-reward-'+i).value);if(rewards[0]===rewards[1])throw Error('两件奖励不能相同');
      const d={names:Object.fromEntries(['zh','en','es','fr'].map(lang=>[lang,$('design-name-'+lang).value])),counts:Object.fromEntries(['seating','tables','lighting','plants'].map(key=>[key,Number($('design-'+key).value)])),tasks:[0,1,2].map(i=>({type:$('design-task-'+i).value,target:Number($('design-target-'+i).value)})),preset:$('design-preset').value,...Object.fromEntries(['width','depth','wallCount','percent'].map(key=>[key,Number($('design-'+key).value)]))};
      levelConfig.set(selected,d);progression.setRewards(selected,rewards);registerTranslations(d.names.zh,[d.names.en||d.names.zh,d.names.es||d.names.zh,d.names.fr||d.names.zh]);
      // An edited level starts from its new brief, while all other layouts stay intact.
      storage.removeItem?.('dreamhome-level-'+selected+'-v1');onConfig(selected);
      $('design-status').textContent='配置已保存，下次开始此关卡生效；奖励已自动交换';
    }catch(error){$('design-status').textContent=error.message||'配置保存失败'}
  });
  doc.addEventListener('keydown',e=>{if(e.key==='Escape'){const id=!$('design-panel').hidden?'design-panel':!$('settings-panel').hidden?'settings-panel':null;if(id){$(id).hidden=true;e.preventDefault();e.stopImmediatePropagation();$('settings-toggle').focus()}}},{capture:true});
  render();return{audio,settings,openDesigner};
}
