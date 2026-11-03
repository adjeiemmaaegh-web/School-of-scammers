#!/usr/bin/env node
/** Additional Linux WebKit browser acceptance; not a replacement for Windows, Edge or Safari validation.
 * Setup: npm install --no-save playwright@1.64.1 && npx playwright install --with-deps webkit
 */
const assert=require('node:assert/strict');
const {webkit}=require('playwright');
const base=(process.env.PLC_BASE_URL||'http://127.0.0.1:4174').replace(/\/+$/,'');
const pause=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
async function go(page,path){
 const r=await page.goto(base+path,{waitUntil:'domcontentloaded',timeout:40000});
 assert.ok([200,304].includes(r?.status()),'HTTP 200 or valid cache 304 for '+path+': '+r?.status());
 await page.locator('h1').first().waitFor({timeout:25000});
 console.log('WEBKIT ROUTE PASS',path);
}
async function run(){
 const browser=await webkit.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  for(const path of ['/','/labs','/engineering','/simulation','/process-control','/starter-lab','/pneumatics','/workcell-composer','/dc-circuit','/electrical-bench','/assessments']){
   await go(page,path);
  }
  await go(page,'/dc-circuit');
  await page.getByRole('button',{name:'Series voltage divider'}).click();
  await page.getByRole('button',{name:'Energize 24 V supply'}).click();
  await page.getByLabel('DC red probe').selectOption('N1');
  await page.getByLabel('DC black probe').selectOption('GND');
  assert.equal((await page.locator('.dc-meter').textContent())?.trim(),'12.000 V DC','Linux WebKit voltage-divider meter');
  await page.getByRole('button',{name:'Isolate 24 V supply'}).click();
  await page.getByRole('button',{name:'Direct supply short'}).click();
  await page.getByRole('button',{name:'Energize 24 V supply'}).click();
  assert.ok((await page.locator('body').innerText()).includes('Cannot energize'),'Linux WebKit short protection');
  console.log('WEBKIT DC LAB PASS');
  await go(page,'/workcell-composer');
  const initial=await page.locator('.composer-cell.occupied').count();
  await page.getByRole('button',{name:'Pump skid'}).click();
  assert.equal(await page.locator('.composer-cell.occupied').count(),initial+1,'Linux WebKit workcell equipment');
  await page.getByRole('button',{name:'Undo'}).click();
  assert.equal(await page.locator('.composer-cell.occupied').count(),initial,'Linux WebKit workcell undo');
  console.log('WEBKIT WORKCELL PASS');
  await page.setViewportSize({width:390,height:780});
  for(const path of ['/','/labs','/electrical-bench','/dc-circuit','/workcell-composer']){
   await go(page,path);
   await pause(100);
   const pair=await page.evaluate(()=>[document.documentElement.scrollWidth,window.innerWidth]);
   assert.ok(pair[0]<=pair[1]+2,'Linux WebKit overflow '+path+': '+pair.join('/'));
   console.log('WEBKIT MOBILE PASS',path);
  }
  assert.deepEqual(errors,[],'No uncaught page exceptions in Linux WebKit');
  console.log('WEBKIT ACCEPTANCE PASS: 11 routes, DC lab, workcell, 390px mobile, no page errors');
 }finally{await browser.close();}
}
run().catch(error=>{console.error('WEBKIT ACCEPTANCE FAIL',error.stack||String(error));process.exitCode=1});
