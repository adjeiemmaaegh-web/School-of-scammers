/** P4 Chrome acceptance: genuinely wire 15-terminal protected DOL, motor/lamp,
 * physical overload interlock, breaker short isolation and worker DC multimeter.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const base=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const links=[
  ['supply-1.P24','breaker-2.IN'],['breaker-2.OUT','plc-3.L+'],
  ['supply-1.M0','plc-3.M'],['breaker-2.OUT','start-4.A'],
  ['start-4.B','plc-3.I0.0'],['breaker-2.OUT','stop-5.A'],
  ['stop-5.B','plc-3.I0.1'],['plc-3.Q0.0','overload-6.95'],
  ['overload-6.96','contactor-7.A1'],['supply-1.M0','contactor-7.A2'],
  ['breaker-2.OUT','contactor-7.13'],['contactor-7.14','motor-8.L+'],
  ['supply-1.M0','motor-8.M-'],['contactor-7.14','lamp-9.L+'],
  ['supply-1.M0','lamp-9.M-'],
];
async function button(page,name){
  const clicked=await page.evaluate(name=>{
    const el=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===name);
    if(!el||el.disabled)return false;el.click();return true;
  },name);
  assert.ok(clicked,`Missing enabled button: ${name}`);
}
async function wire(page,from,to){
  await page.click(`[data-terminal-id="${from}"]`);
  await page.waitForFunction(id=>document.querySelector(`[data-terminal-id="${id}"]`)?.classList.contains('selected'),{},from);
  await page.click(`[data-terminal-id="${to}"]`);
}
const deviceStatus=(page,id,value)=>page.waitForFunction((id,value)=>
  document.querySelector(`[data-device-id="${id}"] .sandbox-device-status`)?.textContent.trim()===value,
  {timeout:10000},id,value);
(async()=>{
  const browser=await puppeteer.launch({headless:true,args:[
    '--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'
  ]});
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  try{
    await page.setViewport({width:1440,height:940,deviceScaleFactor:1});
    await page.goto(base+'/sandbox',{waitUntil:'networkidle0'});
    await page.waitForSelector('.sandbox-toolbar');
    await button(page,'Place protected DOL layout');
    await page.waitForFunction(()=>document.querySelectorAll('.sandbox-device-list .sandbox-device').length===9);
    for(const [from,to] of links)await wire(page,from,to);
    await page.waitForFunction(()=>document.querySelectorAll('.sandbox-wire-list > div').length===15);
    await button(page,'Load editable latch example');
    await button(page,'▶ Run');
    await page.click('[data-device-id="start-4"] .sandbox-operate');
    await deviceStatus(page,'motor-8','RUNNING');
    await deviceStatus(page,'lamp-9','ILLUMINATED');
    assert.equal(await page.$eval('[data-breaker-status]',el=>el.textContent),'CLOSED');

    // Pause and take a genuine differential measurement across the 24 V source.
    await button(page,'Pause');
    await page.select('select[aria-label="Red meter probe"]','supply-1.P24');
    await page.select('select[aria-label="Black meter probe"]','supply-1.M0');
    await page.waitForFunction(()=>document.querySelector('.sandbox-meter-reading')?.textContent.trim()==='24 V DC');

    // Test overload contact: PLC Run stays true while contactor and lamp drop out.
    await page.click('[data-device-id="overload-6"] .sandbox-operate');
    await button(page,'▶ Run');
    await deviceStatus(page,'motor-8','STOPPED');
    await deviceStatus(page,'lamp-9','OFF');
    assert.equal(await page.$eval('[data-overload-status]',el=>el.textContent),'TRIPPED');
    await button(page,'Pause');
    await page.click('[data-device-id="overload-6"] .sandbox-operate');
    await page.waitForFunction(()=>document.querySelector('[data-overload-status]')?.textContent==='CLOSED');
    await button(page,'▶ Run');
    await deviceStatus(page,'motor-8','RUNNING');

    // Inject a real downstream ideal short by wiring the protected node to 0V.
    await button(page,'Pause');
    await wire(page,'breaker-2.OUT','supply-1.M0');
    await page.waitForFunction(()=>document.querySelectorAll('.sandbox-wire-list > div').length===16);
    await button(page,'▶ Run');
    await page.waitForFunction(()=>document.querySelector('[data-breaker-status]')?.textContent==='TRIPPED');
    await deviceStatus(page,'motor-8','STOPPED');
    assert.equal(await page.$eval('[data-lamp-status]',el=>el.textContent),'OFF');

    // Wait for the authoritative Worker to publish PAUSED before editing wires.
    // Running projects correctly disable the patch-panel remove button.
    await button(page,'Pause');
    await page.waitForFunction(()=>[...document.querySelectorAll('.sandbox-toolbar button')]
      .some(b=>b.textContent.trim()==='▶ Run'),{timeout:7000});
    const unwired=await page.evaluate(()=>{
      const row=[...document.querySelectorAll('.sandbox-wire-list > div')].find(el=>
        el.textContent.includes('breaker-2.OUT') && el.textContent.includes('supply-1.M0'));
      const remove=row?.querySelector('button');
      if(remove && !remove.disabled)remove.click();
      return !!remove;
    });
    assert.ok(unwired,'Must remove the actual short wire');
    await page.waitForFunction(()=>document.querySelectorAll('.sandbox-wire-list > div').length===15);
    await page.click('[data-device-id="breaker-2"] .sandbox-operate');
    await page.waitForFunction(()=>document.querySelector('[data-breaker-status]')?.textContent==='CLOSED');
    await button(page,'▶ Run');
    await deviceStatus(page,'motor-8','RUNNING');
    await deviceStatus(page,'lamp-9','ILLUMINATED');
    assert.deepEqual(errors,[]);
    console.log('P4 PANEL BROWSER PASS: 15-wire protected motor, 24V probe, overload trip, downstream short isolation and recovery');
  }finally{await browser.close()}
})().catch(error=>{console.error('P4 PANEL BROWSER FAIL',error.stack||String(error));process.exitCode=1});
