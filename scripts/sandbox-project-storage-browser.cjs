/** Genuine browser regression for active sandbox-project hydration, backup recovery,
 * invalid-primary preservation and advisory cross-tab write ownership.
 * Never treats this localStorage approach as an atomic compare-and-swap system.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const BASE=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const KEY='efo-open-sandbox-project-v1';
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-webgl']});
 const page=await browser.newPage();
 const errors=[];
 page.on('pageerror',error=>errors.push(String(error)));
 const goto=async()=>{
  await page.goto(BASE+'/sandbox',{waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('.sandbox-project-meta small',{timeout:30000});
 };
 const status=async(word)=>{
  await page.waitForFunction(value=>
   document.querySelector('.sandbox-project-meta small')?.textContent.includes(value),
   {timeout:30000},word);
 };
 try{
  await goto();
  await status('Saved in this browser');
  const original=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
  assert.equal(original.formatVersion,1);
  const authored={...original,components:[{id:'qa-supply',kind:'supply',x:15,y:15,pressed:false}]};
  const authoredRaw=JSON.stringify(authored);
  await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key:KEY,raw:authoredRaw});
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await status('Saved in this browser');
  await page.waitForFunction(()=>document.querySelector('.sandbox-workflow-count')?.textContent.trim()==='1',
   {timeout:30000});
  const reloaded=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
  assert.ok(reloaded.components.some(c=>c.id==='qa-supply'),'Saved device was replaced by blank Worker startup');
  console.log('SANDBOX BOOT PASS: valid browser project survives initial blank Worker snapshot and load ACK');

  await page.evaluate(({key,raw})=>{
   localStorage.setItem(key+':recovery-v1',raw);
   localStorage.setItem(key,'{damaged-original');
  },{key:KEY,raw:authoredRaw});
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await status('Saved in this browser');
  const recovered=await page.evaluate(key=>({
   primary:localStorage.getItem(key),damaged:localStorage.getItem(key+':damaged-v1'),
   backup:localStorage.getItem(key+':recovery-v1'),
  }),KEY);
  assert.equal(recovered.damaged,'{damaged-original');
  assert.ok(JSON.parse(recovered.primary).components.some(c=>c.id==='qa-supply'));
  assert.ok(JSON.parse(recovered.backup).components.some(c=>c.id==='qa-supply'));
  console.log('SANDBOX RECOVERY PASS: damaged original quarantined and valid backup recovered');

  await page.evaluate(key=>{
   localStorage.removeItem(key+':recovery-v1');
   localStorage.setItem(key,'{corrupt-no-backup');
  },KEY);
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await status('Not saved');
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY),'{corrupt-no-backup');
  console.log('SANDBOX DAMAGE PASS: no recoverable revision means autosave blocked, no silent overwrite');

  await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key:KEY,raw:authoredRaw});
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await status('Saved in this browser');
  const sibling=await browser.newPage();
  try{
   await sibling.goto(BASE+'/sandbox',{waitUntil:'networkidle0',timeout:45000});
   await sibling.waitForFunction(()=>
    document.querySelector('.sandbox-project-meta small')?.textContent.includes('Saved in this browser'),
    {timeout:30000});
   await sibling.evaluate(key=>{
    const updated=JSON.parse(localStorage.getItem(key));updated.components=[];
    localStorage.setItem(key,JSON.stringify(updated));
   },KEY);
   await status('Not saved');
   const live=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
   assert.deepEqual(live.components,[]);
   console.log('SANDBOX TAB PASS: cross-tab change pauses stale tab autosave');
  }finally{await sibling.close();}
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(e=>{console.error('SANDBOX STORAGE BROWSER FAILURE',e.stack||String(e));process.exitCode=1;});
