/**
 * P3 browser acceptance: user places/wires 3D tank/pump/switch/valve and
 * programs the real worker to fill and drain. Deliberate logic error stops filling.
 * Requires Vite preview + Puppeteer; no prewired or synthetic simulator shortcuts.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const base=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const connections=[
  ['supply-1.P24','plc-2.L+'], ['supply-1.M0','plc-2.M'],
  ['supply-1.P24','stop-3.A'], ['stop-3.B','plc-2.I0.1'],
  ['supply-1.P24','levelprobe-6.L+'], ['supply-1.M0','levelprobe-6.M'],
  ['levelprobe-6.OUT','plc-2.I0.3'],
  ['plc-2.Q0.2','pump-5.L+'], ['supply-1.M0','pump-5.M-'],
  ['plc-2.Q0.3','drainvalve-7.A1'], ['supply-1.M0','drainvalve-7.A2'],
];
async function clickText(page, text) {
  const found=await page.evaluate(name=>{
    const el=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===name);
    if(!el || el.disabled)return false;el.click();return true;
  },text);
  assert.ok(found,`Missing available button: ${text}`);
}
(async ()=>{
  const browser=await puppeteer.launch({headless:true,args:[
    '--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'
  ]});
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.setViewport({width:1440,height:940,deviceScaleFactor:1});
    await page.goto(base+'/sandbox',{waitUntil:'networkidle0'});
    await page.waitForSelector('.sandbox-toolbar');
    await clickText(page,'Place 3D tank layout');
    await page.waitForFunction(()=>document.querySelectorAll('.sandbox-device-list .sandbox-device').length===7);
    for(const [from,to] of connections){
      await page.click(`[data-terminal-id="${from}"]`);
      await page.waitForFunction(x=>document.querySelector(`[data-terminal-id="${x}"]`)?.classList.contains('selected'),{},from);
      await page.click(`[data-terminal-id="${to}"]`);
    }
    await page.waitForFunction(()=>document.querySelectorAll('.sandbox-wire-list > div').length===11);
    await clickText(page,'Load tank control example');
    await page.waitForFunction(()=>document.querySelectorAll('.sandbox-rung').length===3 &&
      document.querySelector('[data-rung-id="inlet-pump"] select[aria-label="Output coil"]')?.value==='Fill');
    await clickText(page,'▶ Run');
    await page.waitForFunction(()=>document.querySelector('[data-tank-level]') &&
      parseInt(document.querySelector('[data-tank-level]').textContent,10)>=150,{timeout:10000});
    assert.equal(await page.$eval('[data-device-id="pump-5"] .sandbox-device-status',e=>e.textContent.trim()),'PUMPING');
    await page.waitForFunction(()=>document.querySelector('[data-tank-high]')?.textContent==='HIGH',{timeout:16000});
    await page.waitForFunction(()=>document.querySelector('[data-tank-drain]')?.textContent==='OPEN',{timeout:10000});
    await page.waitForFunction(()=>document.querySelector('[data-tank-high]')?.textContent==='CLEAR',{timeout:10000});
    const observedLevel=Number((await page.$eval('[data-tank-level]',e=>e.textContent)).replace(/\D/g,''));
    assert.ok(observedLevel>0 && observedLevel<=1000,`Expected bounded water level, got ${observedLevel}`);
    await clickText(page,'Pause');
    await page.waitForFunction(()=>[...document.querySelectorAll('.sandbox-toolbar button')]
      .some(b=>b.textContent.trim()==='▶ Run'),{timeout:7000});
    // User edits the real Ladder contact so Fill is FALSE. No independent renderer logic.
    const fillContacts=await page.$$('[data-rung-id="inlet-pump"] select[aria-label="Contact tag"]');
    assert.equal(fillContacts.length,2);
    await fillContacts[0].select('Unused');
    await page.waitForFunction(()=>[...document.querySelectorAll(
      '[data-rung-id="inlet-pump"] select[aria-label="Contact tag"]')].some(x=>x.value==='Unused'));
    await clickText(page,'▶ Run');
    await page.waitForFunction(() =>
      Number(document.querySelector('.sandbox-scan')?.textContent.replace(/\D/g,'')) >= 12,
      {timeout:10000});
    await page.waitForFunction(()=>document.querySelector('[data-tank-pump]')?.textContent==='OFF',{timeout:7000});
    const initial=await page.$eval('[data-tank-level]',e=>Number.parseInt(e.textContent,10));
    await new Promise(done=>setTimeout(done,450));
    const after=await page.$eval('[data-tank-level]',e=>Number.parseInt(e.textContent,10));
    assert.equal(after,initial,'Wrong Ladder program must not pump imaginary water');
    assert.deepEqual(errors,[]);
    console.log('P3 TANK BROWSER PASS: user-built 11-wire 3D tank, real high switch, drain cycle and wrong PLC program');
  }finally{await browser.close();}
})().catch(error=>{console.error('P3 TANK BROWSER FAIL',error.stack||String(error));process.exitCode=1;});
