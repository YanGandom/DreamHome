import fs from 'node:fs';
import assert from 'node:assert/strict';
import {translate,installI18n,setLanguage,getLanguage} from './i18n.js';
import {TRANSLATIONS} from './locale-data.js';
const cases=[];function test(name,fn){fn();cases.push(name)}
test('every locale row has three nonempty translations',()=>{for(const [key,values]of Object.entries(TRANSLATIONS)){assert.equal(values.length,3,key);assert.ok(values.every(v=>v.length&&!/[\u3400-\u9fff]/.test(v)),key)}});
test('all shipped runtime Chinese phrases have translations in English, Spanish and French',()=>{
 const missing=new Set();for(const file of [...fs.readdirSync('.').filter(f=>f.endsWith('.js')&&!['i18n.js','locale-data.js'].includes(f)),'index.html']){
  const source=fs.readFileSync(file,'utf8').replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g,'').replace(/<option[^>]*data-no-i18n[^>]*>.*?<\/option>/g,'');
  for(const word of source.match(/[\u3400-\u9fff]+/g)||[])for(const lang of ['en','es','fr'])if(/[\u3400-\u9fff]/.test(translate(word,lang)))missing.add(word);
 }assert.deepEqual([...missing],[]);
});
test('dynamic level names, counts, reward names and color ratios translate in all locales',()=>{
 for(const lang of ['en','es','fr'])for(const text of ['第 12 关 · 庭院会客厅','建好 8 × 10 米地基和 2 面墙','超过 30% 的室内家具使用蜂蜜黄色','绒绿双人沙发 · 花纹地毯组合','成就「初次安家」：累计放置物件 5 次（2/5）','已添加绒绿双人沙发，拖动摆放后点击绿色对勾'])assert.ok(!/[\u3400-\u9fff]/.test(translate(text,lang)),text);
});
class Element{constructor(tag='div'){this.nodeType=1;this.tagName=tag.toUpperCase();this.childNodes=[];this.attrs={}}append(n){n.parentElement=this;this.childNodes.push(n)}hasAttribute(k){return k in this.attrs}getAttribute(k){return this.attrs[k]}setAttribute(k,v){this.attrs[k]=v}closest(){return null}}
test('language changes preserve source text and attributes through repeated switches and runtime updates',()=>{
 const root=new Element('html'),button=new Element('button'),text={nodeType:3,nodeValue:'设置'},store=new Map(),storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};button.setAttribute('aria-label','关闭设置');button.append(text);root.append(button);installI18n({documentElement:root},storage);
 for(const lang of ['en','es','fr','zh','en']){setLanguage(lang);assert.equal(text.nodeValue,translate('设置',lang));assert.equal(button.getAttribute('aria-label'),translate('关闭设置',lang))}
 text.nodeValue='音乐';setLanguage('fr');assert.equal(text.nodeValue,'Musique');setLanguage('zh');assert.equal(text.nodeValue,'音乐');assert.equal(getLanguage(),'zh');assert.equal(store.get('dreamhome-language-v1'),'zh');assert.equal(setLanguage('de'),false);
});
console.log(JSON.stringify({passed:cases.length,cases,translations:Object.keys(TRANSLATIONS).length}));
