/**
 * Mandatory P7 reusable station acceptance: actual browser-local shelf
 * captures two user-placed components and the real worker-accepted wire,
 * survives restart, reinserts through the worker paste command, and deletes
 * without changing the commissioned project. No fake project injection.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const base=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const PROJECT='efo-open-sandbox-project-v1';
const ASSEMBLIES='plc-sandbox-local-assemblies-v1';
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:[
  '--no-sandbox','--disable-setuid-sandbox','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
 ]});
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 const saved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null'),PROJECT);
 const count=n=>page.waitForFunction(number=>{
  const p=JSON.parse(localStorage.getItem('efo-open-sandbox-project-v1')||'null');
  return p?.components?.length===number;
 },{timeout:15000},n);
 const place=async label=>{
  const ok=await page.evaluate(value=>{
   const button=[...document.querySelectorAll('.sandbox-palette-item')]
     .find(el=>el.querySelector('strong')?.textContent.trim()===value);
   if(!button||button.disabled)return false;
   button.click();return true;
  },label);
  assert.ok(ok,'Expected registered equipment '+label);
 };
 try{
  await page.setViewport({width:1440,height:940,deviceScaleFactor:1});
  await page.goto(base+'/sandbox',{waitUntil:'domcontentloaded',timeout:45000});
  await page.evaluate(()=>localStorage.clear());
  await page.reload({waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForSelector('[data-p7-assembly-library]');
  await place('24V supply');await count(1);
  await place('24V pilot lamp');await count(2);
  const parts=(await saved()).components;
  const supply=parts.find(c=>c.kind==='supply').id;
  const lamp=parts.find(c=>c.kind==='lamp').id;
  await page.click('[data-p5-view="logical"]');
  await page.waitForSelector(`[data-terminal-id="${supply}.P24"]`);
  await page.click(`[data-terminal-id="${supply}.P24"]`);
  await page.click(`[data-terminal-id="${lamp}.L+"]`);
  await page.waitForFunction(()=>document.querySelectorAll('.sandbox-wire-list>div').length===1,
   {timeout:15000});
  await page.click('[data-p5-view="physical"]');
  await page.waitForSelector('[data-workspace-selection]');
  await page.click('[data-workspace-selection] summary');
  const selected=await page.evaluate(()=>{
   const button=[...document.querySelectorAll('[data-workspace-selection] button')]
     .find(el=>el.textContent.trim()==='Select all');
   if(!button||button.disabled)return false;
   button.click();return true;
  });
  assert.ok(selected);
  await page.waitForFunction(()=>
   document.querySelectorAll('[data-workspace-selection] input:checked').length===2);
  await page.waitForSelector('[data-p7-assembly-library] summary',{timeout:15000});
  await page.click('[data-p7-assembly-library] summary');
  await page.type('[data-assembly-name]','Reusable inspection station');
  await page.click('[data-assembly-save]');
  await page.waitForFunction(key=>{
   const items=JSON.parse(localStorage.getItem(key)||'[]');
   return items.length===1&&items[0].fragment.components.length===2&&
     items[0].fragment.wires.length===1;
  },{timeout:15000},ASSEMBLIES);
  const libraryBefore=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),ASSEMBLIES);
  assert.equal(libraryBefore[0].name,'Reusable inspection station');
  await page.reload({waitUntil:'domcontentloaded',timeout:45000});
  await count(2);
  await page.waitForSelector('[data-p7-assembly-library] summary',{timeout:15000});
  await page.click('[data-p7-assembly-library] summary');
  await page.waitForSelector('[data-assembly-select]');
  assert.equal(await page.$eval('[data-assembly-select]',el=>el.options.length),2);
  await page.click('[data-assembly-insert]');
  await count(4);
  await page.waitForFunction(()=>{
   const p=JSON.parse(localStorage.getItem('efo-open-sandbox-project-v1')||'null');
   return p?.wires?.length===2;
  },{timeout:15000});
  const after=await saved();
  assert.equal(new Set(after.components.map(c=>c.id)).size,4);
  assert.equal(new Set(after.wires.map(w=>w.id)).size,2);
  assert.equal(after.wires.length,2,'Internal electrical connection must be duplicated');
  await page.click('[data-assembly-delete]');
  await page.click('[data-assembly-delete]');
  await page.waitForFunction(key=>
   JSON.parse(localStorage.getItem(key)||'[]').length===0,{timeout:12000},ASSEMBLIES);
  assert.equal((await saved()).components.length,4,
   'Deleting a template must not delete commissioned machines');
  // Invalid local storage must be preserved, never silently overwritten.
  await page.evaluate(key=>localStorage.setItem(key,'{broken'),ASSEMBLIES);
  await page.reload({waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForSelector('[data-p7-assembly-library] summary',{timeout:15000});
  await page.click('[data-p7-assembly-library] summary');
  await page.waitForSelector('[data-assembly-reset]');
  assert.equal(await page.$eval('[data-assembly-save]',button=>button.disabled),true);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),ASSEMBLIES),'{broken');
  await page.click('[data-assembly-reset]');
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),ASSEMBLIES),'{broken');
  await page.click('[data-assembly-reset]');
  await page.waitForFunction(key=>localStorage.getItem(key)===null,{timeout:10000},ASSEMBLIES);
  assert.equal((await saved()).components.length,4,'Reset library may not reset current workcell');
  assert.deepEqual(errors.filter(e=>!/WebGL|GPU stall|favicon|swiftshader/i.test(e)),[]);
  console.log('P7 REUSABLE ASSEMBLY PASS: real machines and wire -> local shelf -> restart -> worker paste -> delete; no cloud');
 }finally{await browser.close();}
})().catch(error=>{console.error('P7 REUSABLE ASSEMBLY FAIL',error.stack||String(error));process.exitCode=1;});
