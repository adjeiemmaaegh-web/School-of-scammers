/** Every ranked PLC/CCTV exercise must be reachable and interactive in
 * genuine Chromium from the public trade ladder, not only via unit imports.
 * Training features only; real PLC/CCTV equipment acceptance remains open.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const base=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:[
  '--no-sandbox','--disable-setuid-sandbox','--disable-gpu']});
 const page=await browser.newPage(),errors=[];page.on('pageerror',x=>errors.push(String(x)));
 try{
  await page.setViewport({width:1280,height:850});
  let visited=0;
  for(const trade of ['plc','cctv']){
   await page.goto(base+'/trade/'+trade,{waitUntil:'domcontentloaded',timeout:40000});
   await page.waitForSelector('.ladder-list .ladder-item.playable a.ladder-link',{timeout:20000});
   const exerciseLinks=await page.$$eval('.ladder-list .ladder-item.playable a.ladder-link',
    links=>links.map(el=>el.getAttribute('href')).filter(h=>h.startsWith('/exercise/')));
   assert.equal(exerciseLinks.length,10,'All ten ranked exercises must be available for '+trade);
   assert.equal(new Set(exerciseLinks).size,10,'Unique exercises for '+trade);
   for(const link of exerciseLinks){
    const response=await page.goto(base+link,{waitUntil:'domcontentloaded',timeout:40000});
    assert.equal(response.status(),200,'SPA route '+link);
    await page.waitForSelector('.exercise-shell .exercise-sim',{timeout:20000});
    assert.ok(await page.$('.objective-list'),'Objective panel for '+link);
    const buttons=await page.$$eval('.exercise-sim button',nodes=>nodes.filter(x=>!x.disabled).length);
    assert.ok(buttons>0,'At least one enabled simulated action in '+link);
    const title=await page.$eval('.exercise-shell h1',el=>el.textContent.trim());
    assert.ok(title.length>0,'Exercise title '+link);
    visited++;
   }
   console.log('QA TRADE BROWSER PASS:',trade,exerciseLinks.length,'ranked playable UI routes');
  }
  assert.equal(visited,20);
  assert.deepEqual(errors,[],'No React runtime error on all 20 rank UI routes');
  console.log('QA ALL TRADES PASS:',visited,'genuine ranked PLC/CCTV exercise pages interactive');
 }finally{await browser.close();}
})().catch(e=>{console.error('QA ALL TRADES BROWSER FAIL',e.stack||String(e));process.exitCode=1;});
