#!/usr/bin/env node
/**
 * Browser acceptance smoke, run against built static site or hosted URL.
 * Optional QA dependency: npm install --no-save puppeteer@24.31.0
 * Then: npx puppeteer browsers install chrome
 * Usage: PLC_BASE_URL=http://127.0.0.1:4173 node scripts/browser-acceptance.cjs
 * Not a substitute for hardware-fidelity or cross-browser acceptance.
 */
const assert=require('node:assert/strict');
let puppeteer;
try{puppeteer=require('puppeteer');}
catch{console.error('Optional browser QA dependency missing: npm install --no-save puppeteer@24.31.0');process.exit(2);}
const base=(process.env.PLC_BASE_URL||'http://127.0.0.1:4173').replace(/\/+$/,'');
const pause=(ms)=>new Promise(r=>setTimeout(r,ms));
async function click(page,text){
 for(const button of await page.$$('button')){
  const label=await button.evaluate(node=>node.textContent?.trim()||'');
  if(label.includes(text)){await button.click();await pause(60);return;}
 }
 throw new Error('Expected button not found: '+text);
}
async function visit(page,route){
 const response=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:30000});
 assert.equal(response?.status(),200,'Page HTTP status for '+route);
 await page.waitForSelector('h1',{timeout:18000});
 assert.ok(await page.$eval('h1',node=>node.textContent?.trim().length),route+' missing page heading');
}
async function run(){
 const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote']});
 const page=await browser.newPage();
 const exceptions=[];page.on('pageerror',e=>exceptions.push(e.message));
 try{
  await page.setViewport({width:1366,height:768});
  const routes=['/','/labs','/engineering','/simulation','/assessments','/process-control','/starter-lab','/electrical-bench'];
  for(const route of routes){await visit(page,route);console.log('ROUTE PASS',route);}
  await visit(page,'/starter-lab');await page.waitForSelector('.starter-control-diagram');
  await click(page,'Press START');for(let i=0;i<4;i++)await click(page,'Advance 1 s');
  assert.equal(await page.$eval('.metric-grid .metric b',e=>e.textContent?.trim()),'DELTA','Starter must reach DELTA');
  await click(page,'Press STOP');
  assert.equal(await page.$eval('.metric-grid .metric b',e=>e.textContent?.trim()),'IDLE','STOP must drop contactor commands');
  console.log('STARTER PASS');
  await visit(page,'/electrical-bench');await page.waitForSelector('.patch-ports');
  await click(page,'Connect wire');await click(page,'Close S1');await click(page,'Energize 24 V supply');
  assert.ok((await page.$eval('.patch-light-on',e=>e.textContent||'')).includes('LIT'));
  assert.equal(await page.$eval('.patch-meter',e=>e.textContent?.trim()),'24.0 V DC','Correct loop meter voltage');
  await click(page,'Isolate supply');console.log('PATCH BENCH PASS');
  await visit(page,'/process-control');await click(page,'Run 10 s');console.log('PID SCAN PASS');
  await visit(page,'/simulation');
  for(const b of ['Record visual inspection','Read PLC I/O','Reconnect sensor circuit','START MOTOR','Verify operation','Submit task'])await click(page,b);
  assert.ok((await page.$eval('body',e=>e.innerText)).includes('Assessment report'));
  console.log('ASSESSMENT PASS');
  await page.setViewport({width:390,height:780});
  for(const route of ['/','/labs','/starter-lab','/electrical-bench']){
   await visit(page,route);
   const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));
   assert.ok(size.scroll<=size.viewport+2,'Horizontal mobile overflow '+route+' '+JSON.stringify(size));
   console.log('MOBILE PASS',route);
  }
  assert.deepEqual(exceptions,[],'Uncaught browser errors');
  console.log('BROWSER SMOKE PASS: '+routes.length+' routes, interactions, 390px mobile and no page exceptions');
 }finally{await browser.close();}
}
run().catch(e=>{console.error('BROWSER SMOKE FAIL',e.stack||String(e));process.exitCode=1;});