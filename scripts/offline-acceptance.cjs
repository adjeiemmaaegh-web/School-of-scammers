#!/usr/bin/env node
/** Chrome release smoke: a previously installed built site must load deep links
 * and lazily-loaded labs with the network disabled.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const base=(process.env.PLC_BASE_URL||'http://127.0.0.1:4173').replace(/\/+$/,'');
async function run(){
 const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote']});
 try{
  const page=await browser.newPage();
  await page.goto(base+'/engineering',{waitUntil:'load',timeout:35000});
  await page.waitForSelector('h1');
  const capability=await page.evaluate(()=>('serviceWorker' in navigator));
  assert.equal(capability,true,'Browser must expose service workers');
  await page.waitForFunction(async()=>{
   const registration=await navigator.serviceWorker.getRegistration('/');
   return Boolean(registration?.active && navigator.serviceWorker.controller);
  },{timeout:30000,polling:250});
  const ready=await page.evaluate(async()=>{
   const registration=await navigator.serviceWorker.ready;
   const cache=await caches.keys();
   return {active:registration.active?.state,cache:cache.filter(x=>x.startsWith('plc-skills-lab-shell-'))};
  });
  assert.equal(ready.active,'activated');
  assert.equal(ready.cache.length,1,'Expected one versioned offline cache');
  await page.setOfflineMode(true);
  for(const route of ['/engineering','/dc-circuit','/process-control','/workcell-composer']){
   const response=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:35000});
   assert.ok(response,'Offline navigation should resolve cached app shell: '+route);
   await page.waitForSelector('h1',{timeout:25000});
   const text=await page.$eval('h1',el=>el.textContent?.trim()||'');
   assert.ok(text.length>0,'Offline route must render heading: '+route);
   assert.ok(!text.toLowerCase().includes('not found'),'Offline route unexpected 404: '+route);
   console.log('OFFLINE ROUTE PASS '+route+' · '+text);
  }
  await page.setOfflineMode(false);
  const state=await page.evaluate(()=>({controller:!!navigator.serviceWorker.controller,manifest:document.querySelector('link[rel="manifest"]')?.getAttribute('href')}));
  assert.equal(state.controller,true);
  assert.equal(state.manifest,'/manifest.webmanifest');
  console.log('OFFLINE ACCEPTANCE PASS: pre-cached lazy labs and direct deep links');
 }finally{await browser.close();}
}
run().catch(error=>{console.error('OFFLINE ACCEPTANCE FAIL',error);process.exitCode=1});
