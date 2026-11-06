/**
 * P3 genuine browser integration: place 3D sorting plant, wire all 16 physical nets,
 * author and execute Ladder, then validate marked/unmarked/wrong-program routing.
 * All movement is worker-published; no DOM animation or synthetic trace injection.
 */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';

const connections = [
  ['supply-1.P24','plc-2.L+'], ['supply-1.M0','plc-2.M'],
  ['supply-1.P24','start-5.A'], ['start-5.B','plc-2.I0.0'],
  ['supply-1.P24','stop-6.A'], ['stop-6.B','plc-2.I0.1'],
  ['supply-1.P24','contactor-3.13'], ['supply-1.M0','contactor-3.A2'],
  ['plc-2.Q0.0','contactor-3.A1'], ['contactor-3.14','conveyor-4.L+'],
  ['supply-1.M0','conveyor-4.M-'],
  ['supply-1.P24','photoeye-7.L+'], ['supply-1.M0','photoeye-7.M'],
  ['photoeye-7.OUT','plc-2.I0.2'],
  ['plc-2.Q0.1','diverter-8.A1'], ['supply-1.M0','diverter-8.A2'],
];
async function button(page,text) {
  const clicked=await page.evaluate(name=>{
    const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===name);
    if(!b||b.disabled)return false;
    b.click();return true;
  },text);
  assert.ok(clicked,`Expected enabled button "${text}"`);
}
(async ()=>{
  const browser=await puppeteer.launch({headless:true,args:[
    '--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'
  ]});
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  try {
    await page.setViewport({width:1440,height:940,deviceScaleFactor:1});
    await page.goto(base+'/sandbox',{waitUntil:'networkidle0'});
    await page.waitForSelector('.sandbox-toolbar');
    await button(page,'Place 3D sorting layout');
    await page.waitForFunction(()=>document.querySelectorAll('.sandbox-device-list .sandbox-device').length===8);
    for(const [from,to] of connections) {
      await page.click(`[data-terminal-id="${from}"]`);
      await page.waitForFunction(name=>document.querySelector(`[data-terminal-id="${name}"]`)?.classList.contains('selected'),{},from);
      await page.click(`[data-terminal-id="${to}"]`);
    }
    await page.waitForFunction(()=>document.querySelectorAll('.sandbox-wire-list > div').length===16);
    await button(page,'Load sorting program example');
    await page.waitForFunction(()=>document.querySelectorAll('.sandbox-rung').length===2 &&
      document.querySelector('[data-rung-id="sort-at-eye"] select[aria-label="Output coil"]')?.value==='Sort');
    await button(page,'▶ Run');
    await page.click('[data-device-id="start-5"] .sandbox-operate');
    await page.waitForFunction(()=>document.querySelector('[data-device-id="conveyor-4"] .sandbox-device-status')?.textContent==='BELT MOVING',{timeout:9000});
    await button(page,'Feed marked parcel');
    await page.waitForFunction(()=>document.querySelector('[data-sort-rejected]')?.textContent==='1',{timeout:12000});
    assert.equal(await page.$eval('[data-sort-accepted]',el=>el.textContent),'0');
    await button(page,'Feed plain parcel');
    await page.waitForFunction(()=>document.querySelector('[data-sort-accepted]')?.textContent==='1',{timeout:12000});
    assert.equal(await page.$eval('[data-sort-rejected]',el=>el.textContent),'1');
    const traced=await page.evaluate(()=>
      [...document.querySelectorAll('.sandbox-event-list p')].map(p=>p.textContent).join('\n'));
    assert.match(traced,/reject route selected by wired diverter/);
    assert.match(traced,/accept route selected by wired diverter/);

    // Deliberately wrong learner code: same marked parcel must now enter pass lane.
    await button(page,'Pause');
    await page.waitForFunction(()=>[...document.querySelectorAll('.sandbox-toolbar button')]
      .some(b=>b.textContent.trim()==='▶ Run'));
    const contacts=await page.$$('[data-rung-id="sort-at-eye"] select[aria-label="Contact tag"]');
    assert.equal(contacts.length,2);
    await contacts[1].select('Unused');
    await page.waitForFunction(()=>document.querySelector('[data-rung-id="sort-at-eye"] select[aria-label="Contact tag"]:last-of-type')?.value === 'Unused').catch(()=>{});
    await button(page,'▶ Run');
    await page.waitForFunction(()=>document.querySelector('[data-device-id="conveyor-4"] .sandbox-device-status')?.textContent==='BELT MOVING',{timeout:9000});
    await button(page,'Feed marked parcel');
    await page.waitForFunction(()=>document.querySelector('[data-sort-accepted]')?.textContent==='1',{timeout:12000});
    assert.equal(await page.$eval('[data-sort-rejected]',el=>el.textContent),'0',
      'Edited wrong logic must not reject marked parcel');
    // The program reload reset the counters; a new marked parcel must be accepted.
    await page.screenshot({path:'qa-artifacts/sandbox-p3-sorting.png',fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('P3 3D SORTING PASS: placed/wired photoeye and diverter, marked reject, plain pass, deliberately wrong code changes routing');
  } finally {await browser.close();}
})().catch(error=>{console.error('P3 3D SORTING FAIL',error.stack||String(error));process.exitCode=1;});
