/** Black-box QA regression: untrusted routes, assignment codes and returned
 * assessment codes cannot crash the React application or render false grades.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const BASE=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const code=value=>Buffer.from(JSON.stringify(value),'utf8').toString('base64url');
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:[
  '--no-sandbox','--disable-setuid-sandbox',
  '--disable-webgl',
 ]});
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(String(error)));
 try{
  await page.setViewport({width:1280,height:800});
  await page.goto(BASE+'/trade/__proto__',{waitUntil:'networkidle0',timeout:45000});
  assert.match(await page.$eval('main',e=>e.textContent),/Trade not found/);
  await page.goto(BASE+'/trade/constructor',{waitUntil:'networkidle0',timeout:45000});
  assert.match(await page.$eval('main',e=>e.textContent),/Trade not found/);
  await page.goto(BASE+'/trade/plc',{waitUntil:'networkidle0',timeout:45000});
  assert.match(await page.$eval('main',e=>e.textContent),/Climb the ladder/);
  console.log('QA ROUTE PASS: malformed prototype-chain trade IDs are harmless, legitimate PLC survives');
  const incompleteAssignment=code({kind:'skills-lab-assignment'});
  await page.goto(BASE+'/take#a='+incompleteAssignment,{waitUntil:'networkidle0',timeout:45000});
  assert.match(await page.$eval('main',e=>e.textContent),/Open your assigned task/);
  assert.match(await page.$eval('.field-error',e=>e.textContent),/Invalid assignment/i);
  assert.equal(await page.$$eval('button',els=>els.some(e=>e.textContent.includes('Begin assessment'))),false);
  console.log('QA CANDIDATE PASS: invalid assignment link rejected before learner assessment starts');
  const assignment=(seed)=>({kind:'skills-lab-assignment',
   formatVersion:1,trade:'plc',exerciseId:'plc-conveyor-start',
   exerciseVersion:'1.0',mode:'assessment',seed,
   createdAt:'2026-11-14T11:00:00.000Z'});
  await page.evaluate(hash=>{location.hash='#a='+hash;},code(assignment(42)));
  await page.waitForSelector('.exam-notes',{timeout:15000});
  assert.match(await page.$eval('main',e=>e.textContent),/Before you begin/);
  await page.$eval('button',buttons=>{
   const begin=Array.from(buttons).find(b=>b.textContent.includes('Begin assessment'));
   if(!begin)throw Error('Valid candidate assignment had no start button');
   begin.click();
  });
  await page.waitForFunction(()=>!document.querySelector('.exam-notes'),{timeout:15000});
  await page.evaluate(hash=>{location.hash='#a='+hash;},code(assignment(43)));
  await page.waitForSelector('.exam-notes',{timeout:15000});
  assert.match(await page.$eval('main',e=>e.textContent),/Before you begin/);
  console.log('QA CANDIDATE STATE PASS: changing assignment hash resets exam introduction');
  await page.goto(BASE+'/employer',{waitUntil:'networkidle0',timeout:45000});
  await page.type('.code-input',code({kind:'skills-lab-result'}));
  await page.click('.review-card button');
  await page.waitForSelector('.review-card .field-error',{timeout:10000});
  assert.match(await page.$eval('.review-card .field-error',e=>e.textContent),/Invalid result/i);
  assert.equal(await page.$$eval('.review-out',els=>els.length),0);
  console.log('QA EMPLOYER PASS: malformed result rejected as field error before rubric rendering');
  const hasCrash=errors.some(e=>/Cannot read|undefined|TypeError|Uncaught|React error/i.test(e));
  assert.equal(hasCrash,false,'Untrusted input triggered an uncaught app exception: '+errors.join('\n'));
  console.log('QA CROSS-PAGE PASS: no uncaught crash on prototype routes or malformed share codes');
 }finally{await browser.close();}
})().catch(e=>{console.error('QA UNTRUSTED BROWSER FAILURE',e.stack||String(e));process.exitCode=1;});
