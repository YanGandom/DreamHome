import {TRANSLATIONS} from './locale-data.js';
export const LANGUAGES=['zh','en','es','fr'];
let language='zh',activeDocument=null,activeStorage=null,observer=null;
const originals=new WeakMap(),extra=new Map();
export const getLanguage=()=>language;
export function registerTranslations(zh,values){if(zh)extra.set(zh,values);if(activeDocument)refreshLanguage()}
export function translate(source,lang=language){
  if(!source||lang==='zh')return source;const index=LANGUAGES.indexOf(lang)-1;if(index<0)return source;
  const exact=extra.get(source)||TRANSLATIONS[source];if(exact)return exact[index];
  let text=source.replace(/第\s*(\d+)\s*关/g,(_,n)=>['Level '+n,'Nivel '+n,'Niveau '+n][index]);
  text=text.replace(/超过 (\d+)% 的室内家具使用([^。]+)/g,(_,n,color)=>[`More than ${n}% of indoor furniture in ${translate(color,lang)}`,`Más del ${n}% de los muebles interiores en ${translate(color,lang)}`,`Plus de ${n}% du mobilier intérieur en ${translate(color,lang)}`][index]);
  text=text.replace(/[\u3400-\u9fff]+/g,word=>{
    const values=extra.get(word)||TRANSLATIONS[word];if(values)return ' '+values[index]+' ';
    // Dynamic messages can join component names with action fragments.
    const keys=[...extra.keys(),...Object.keys(TRANSLATIONS)].sort((a,b)=>b.length-a.length);let rest=word,out='';
    while(rest){const key=keys.find(k=>rest.startsWith(k));if(key){out+=(extra.get(key)||TRANSLATIONS[key])[index]+' ';rest=rest.slice(key.length)}else{out+=rest[0];rest=rest.slice(1)}}return ' '+out.trim()+' ';
  });
  return text.replace(/，/g,', ').replace(/。/g,'. ').replace(/；/g,'; ').replace(/：/g,': ').replace(/、/g,', ').replace(/！/g,'!').replace(/？/g,'?').replace(/[「」]/g,'"').replace(/（/g,'(').replace(/）/g,')').replace(/[ \t]+/g,' ').trim();
}
function localize(node){
  if(node.nodeType===3){if(node.parentElement?.closest('script,style,textarea,[data-no-i18n]'))return;let record=originals.get(node);if(!record||node.nodeValue!==record.output)record={source:node.nodeValue};record.output=translate(record.source);originals.set(node,record);if(node.nodeValue!==record.output)node.nodeValue=record.output;return}
  if(node.nodeType!==1&&node.nodeType!==9)return;
  if(node.nodeType===1){if(['SCRIPT','STYLE','TEXTAREA'].includes(node.tagName)||node.hasAttribute?.('data-no-i18n'))return;
    let cache=originals.get(node)||{};for(const attr of ['title','aria-label','placeholder','alt']){if(!node.hasAttribute(attr))continue;const value=node.getAttribute(attr),r=cache[attr];const source=r&&r.output===value?r.source:value,output=translate(source);cache[attr]={source,output};if(value!==output)node.setAttribute(attr,output)}originals.set(node,cache);
  }
  for(const child of node.childNodes||[])localize(child);
}
export function refreshLanguage(){if(!activeDocument)return;localize(activeDocument.documentElement);activeDocument.documentElement.lang=language==='zh'?'zh-CN':language}
export function setLanguage(value){if(!LANGUAGES.includes(value))return false;language=value;try{activeStorage?.setItem('dreamhome-language-v1',value)}catch{}refreshLanguage();return true}
export function installI18n(doc=document,storage){
  if(!storage)try{storage=globalThis.localStorage}catch{storage={getItem:()=>null,setItem(){}}}
  activeDocument=doc;activeStorage=storage;try{const saved=storage.getItem('dreamhome-language-v1');if(LANGUAGES.includes(saved))language=saved}catch{}
  observer?.disconnect();refreshLanguage();if(globalThis.MutationObserver){observer=new MutationObserver(records=>{for(const r of records){if(r.type==='childList')r.addedNodes.forEach(localize);else localize(r.target)}});observer.observe(doc.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder','alt']})}
  return{setLanguage,translate,dispose:()=>observer?.disconnect()};
}
