#!/usr/bin/env node
/** QA: browser-rendering regression for untrusted external shared codes.
 * Only public local pages; no account, backend, remote link, or credential.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const base=(process.env.PLC_BASE_URL||'http://127.0.0.1:4173').replace(/\/+$/,'');
const code=(payload)=>Buffer.from(JSON.stringify(payload)).toString('base64url');
const assignment={
 kind:'skills-lab-assignment',formatVersion:1,trade:'plc',
 exerciseId:'plc-sbx-startstop',exerciseVersion:'1.0',mode:'assessment',
 seed:42,createdAt:'2026-11-14T00:00:00.000Z',
};
const result={
 kind:'skills-lab-result',formatVersion:1,assignment,
 startedAt:'2026-11-14T00:00:00.000Z',
 finishedAt:'2026-11-14T00:00:10.000Z',durationMs:10000,
 evidence:[],rubric:{score:80,max:100,passed:true,safetyHold:false,
  criteria:[{id:'control',label:'Control',max:100,earned:80,reason:'Virtual assessment'}]},
};
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:[
  '--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu',
 ]});
 const page=await browser.newPage();
 const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
 const visit=async route=>{
  const res=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:45000});
  assert.ok([200,304].includes(res?.status()),'Cannot load '+route);
  await page.waitForSelector('h1',{timeout:18000});
 };
 try{
  await visit('/take#a='+code(assignment));
  assert.ok((await page.$eval('body',e=>e.innerText)).includes('Before you begin'),
   'Genuine version-1 offline assignment must still show candidate intro');
  for(const invalid of [
   {kind:'skills-lab-assignment'},
   {...assignment,formatVersion:2},
   {...assignment,seed:'NaN'},
   {...assignment,exerciseId:'../../bad'},
  ]){
   await visit('/take#a='+code(invalid));
   const text=await page.$eval('body',e=>e.innerText);
   assert.ok(text.includes('Not a valid EFO Skill Lab assignment.'),
    'Malformed candidate link must show recoverable error instead of rendering a task');
   assert.ok(!text.includes('Before you begin'),
    'A rejected assignment must not open an assessment');
  }
  await visit('/employer');
  await page.waitForSelector('.review-card textarea');
  const setCode=async val=>{
   await page.$eval('.review-card textarea',(e,value)=>{
    const native=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
    native.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}));
   },val);
   await page.click('.review-card button');
  };
  await setCode(code({kind:'skills-lab-result'}));
  await page.waitForFunction(()=>!!document.querySelector('.review-card .field-error'),{timeout:8000});
  assert.ok((await page.$eval('.review-card .field-error',e=>e.textContent))
   .includes('Not a valid EFO Skill Lab result.'));
  assert.equal(await page.$('.review-card .result-panel'),null);
  await setCode(code(result));
  await page.waitForSelector('.review-card .result-panel',{timeout:8000});
  assert.equal(await page.$('.review-card .field-error'),null);
  assert.deepEqual(pageErrors,[],'Malicious/valid codes must not throw React/browser errors');
  console.log('QA SHARED-CODE BROWSER PASS: valid assignment/result, corrupted assignments and malformed returned result stay recoverable without page exceptions');
 }finally{await browser.close();}
})().catch(e=>{console.error('QA SHARED-CODE BROWSER FAIL:',e.stack||String(e));process.exitCode=1;});
