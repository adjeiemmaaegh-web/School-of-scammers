/** Security/functional browser QA:
 * untrusted assignment/result codes must not crash React;
 * candidate hash changes must not inherit assessment state;
 * original employer assignment metadata must return intact.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const BASE=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const code=o=>Buffer.from(JSON.stringify(o),'utf8').toString('base64url');
const read=s=>JSON.parse(Buffer.from(s,'base64url').toString('utf8'));
const initial={
 kind:'skills-lab-assignment',formatVersion:1,trade:'plc',
 exerciseId:'plc-conveyor-start',exerciseVersion:'1.0.0',
 mode:'assessment',seed:42,label:'QA hiring review – ①',
 createdAt:'2026-11-14T00:00:00.000Z',
};
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-gpu']});
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.setViewport({width:1366,height:900});
  // Wrong shape with plausible kind and a React-invalid object label must not
  // render or crash a candidate's browser.
  await page.goto(BASE+'/take#a='+code({...initial,label:{bad:'object'}}),
   {waitUntil:'networkidle0',timeout:40000});
  await page.waitForSelector('h1');
  assert.match(await page.$eval('main',x=>x.textContent),/invalid|error|assigned task/i);
  // Genuine code opens a gated candidate intro, no answers or modes exposed.
  await page.goto(BASE+'/take#a='+code(initial),{waitUntil:'networkidle0'});
  await page.waitForFunction(()=>document.querySelector('main h1')?.textContent.includes('Conveyor'));
  assert.match(await page.$eval('main',x=>x.textContent),/QA hiring review/);
  await page.click('button.btn.primary.block');
  await page.waitForSelector('.exercise-shell');
  await page.evaluate(()=>{
   const btn=[...document.querySelectorAll('button')].find(b=>b.textContent?.trim()==='Record visual inspection');
   if(!btn)throw Error('QA original exercise action not found');
   btn.click();
  });
  await page.waitForFunction(()=>document.querySelectorAll('.evidence-row').length===1,
   {timeout:8000});
  assert.equal(await page.$$eval('.evidence-row',els=>els.length),1,
   'React StrictMode must record exactly one evidence action per real click');
  const a=await page.$eval('main',x=>x.textContent);
  assert.match(a,/Assessment · exam conditions/);
  // Switching assignment on the SAME tab must not inherit prior started state.
  const replacement={...initial,seed:65535,label:'Second candidate – reset intro'};
  await page.evaluate(x=>{window.location.hash='#a='+x;},code(replacement));
  await page.waitForFunction(()=>document.querySelector('main')?.textContent.includes('Second candidate'));
  assert.equal(await page.$('.exercise-shell'),null,
   'New candidate assignment must require its own intro instead of leaking prior exam state');
  assert.ok(await page.$('button.btn.primary.block'),'Fresh Begin assessment button required');
  await page.click('button.btn.primary.block');
  await page.waitForSelector('.exercise-shell');
  // Capture a real result via genuine learner submit, not a forged "valid" UI
  // result fixture. Score may be low; original metadata must still return.
  const submit=await page.$x?.("//button[contains(.,'Submit for assessment')]")??[];
  if(submit.length)await submit[0].click();
  else await page.evaluate(()=>{
   const b=[...document.querySelectorAll('button')].find(e=>e.textContent?.includes('Submit for assessment'));
   if(!b)throw Error('Cannot submit actual exercise');b.click();
  });
  await page.waitForSelector('textarea[id="copy-Result code"]',{timeout:25000});
  const returned=await page.$eval('textarea[id="copy-Result code"]',el=>el.value);
  const decoded=read(returned);
  assert.equal(decoded.kind,'skills-lab-result');
  assert.deepEqual(decoded.assignment,replacement,
   'Result must retain employer-provided label, seed, original timestamp, trade, and exercise version');
  assert.ok(decoded.rubric&&Array.isArray(decoded.rubric.criteria));
  console.log('QA CANDIDATE PASS: no malformed-code crash, no cross-assignment state leakage, exact original metadata returned');
  // Cross-trade or wrong-version codes must not silently run a different assessment.
  for(const wrong of [{...initial,exerciseVersion:'900.0.0'},
   {...initial,trade:'cctv'}]){
   await page.goto(BASE+'/take#a='+code(wrong),{waitUntil:'networkidle0'});
   await page.waitForSelector('h1');
   assert.match(await page.$eval('main',x=>x.textContent),/isn't available|version|mismatch|unsupported/i);
   assert.equal(await page.$('button.btn.primary.block'),null,
    'Wrong exercise version or trade must block the candidate assessment');
  }
  // Employer review must render a genuine code but reject malformed nested
  // rubric without a React crash.
  await page.goto(BASE+'/employer',{waitUntil:'networkidle0'});
  await page.waitForSelector('.review-card textarea');
  await page.$eval('.review-card textarea',(el,v)=>{
   const set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;
   set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));
  },returned);
  await page.click('.review-card button');
  await page.waitForSelector('.review-out');
  assert.match(await page.$eval('.review-out',x=>x.textContent),/Second candidate/);
  const invalid=code({...decoded,rubric:{passed:true}});
  await page.$eval('.review-card textarea',(el,v)=>{
   const set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;
   set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));
  },invalid);
  await page.click('.review-card button');
  await page.waitForSelector('.review-card .field-error');
  assert.equal(await page.$('.review-out'),null);
  assert.deepEqual(errors,[],'No unhandled page errors from malformed untrusted review codes');
  console.log('QA EMPLOYER PASS: verified shape review, invalid rubric rejected before React rendering');
 }finally{await browser.close();}
})().catch(e=>{console.error('QA CANDIDATE/EMPLOYER FAIL',e.stack||e);process.exitCode=1;});
