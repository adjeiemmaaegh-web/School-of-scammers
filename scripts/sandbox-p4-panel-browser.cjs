/** P4 genuine Chrome/Worker acceptance: user wires 16-terminal protected DOL
 * and verifies motor, lamp, electrical NC/E-stop, breaker and real two-probe meter.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const base=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const links=[
  ['supply-1.P24','breaker-2.IN'],['breaker-2.OUT','estop-3.A'],
  ['estop-3.B','plc-4.L+'],['estop-3.B','start-5.A'],
  ['estop-3.B','stop-6.A'],['estop-3.B','contactor-8.13'],
  ['supply-1.M0','plc-4.M'],['supply-1.M0','contactor-8.A2'],
  ['supply-1.M0','motor-9.M-'],['supply-1.M0','lamp-10.M-'],
  ['start-5.B','plc-4.I0.0'],['stop-6.B','plc-4.I0.1'],
  ['plc-4.Q0.0','overload-7.95'],['overload-7.96','contactor-8.A1'],
  ['contactor-8.14','motor-9.L+'],['contactor-8.14','lamp-10.L+'],
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
const state=(page,id,value)=>page.waitForFunction((id,value)=>
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
    await page.waitForFunction(()=>document.querySelectorAll('.sandbox-device-list .sandbox-device').length===10);
    for(const [from,to] of links) await wire(page,from,to);
    await page.waitForFunction(()=>document.querySelectorAll('.sandbox-wire-list > div').length===16);
    await button(page,'Load editable latch example');
    await button(page,'▶ Run');
    await page.click('[data-device-id="start-5"] .sandbox-operate');
    await state(page,'motor-9','RUNNING');
    await state(page,'lamp-10','ILLUMINATED');
    assert.equal(await page.$eval('[data-breaker-status]',el=>el.textContent),'CLOSED');

    // Real terminal potential; pauses and probe changes cannot fake a scan.
    await page.click('[data-device-id="start-5"] .sandbox-operate'); // release
    await button(page,'Pause');
    await page.select('select[aria-label="Red meter probe"]','estop-3.B');
    await page.select('select[aria-label="Black meter probe"]','supply-1.M0');
    await page.waitForFunction(()=>document.querySelector('.sandbox-meter-reading')?.textContent.trim()==='24 V DC');

    // Real overload auxiliary opens contactor while PLC Run retains its latch.
    await page.click('[data-device-id="overload-7"] .sandbox-operate');
    await button(page,'▶ Run');
    await state(page,'motor-9','STOPPED');
    await state(page,'lamp-10','OFF');
    assert.equal(await page.$eval('[data-overload-status]',el=>el.textContent),'TRIPPED');
    await button(page,'Pause');
    await page.click('[data-device-id="overload-7"] .sandbox-operate');
    await page.waitForFunction(()=>document.querySelector('[data-overload-status]')?.textContent==='CLOSED');
    await button(page,'▶ Run');
    // Deliberately unsafe simple Run latch: overload reset can restart the motor.
    await state(page,'motor-9','RUNNING');

    // Latching NC training E-stop interrupts the ACTUAL power path.
    await button(page,'Press E-stop (training)');
    await state(page,'motor-9','STOPPED');
    await page.waitForFunction(()=>document.querySelector('[data-estop-state]')?.textContent==='OPEN');
    await button(page,'Reset E-stop (training)');
    await page.waitForFunction(()=>document.querySelector('[data-estop-state]')?.textContent==='RESET');
    await state(page,'motor-9','STOPPED'); // PLC Run latch lost power
    await page.click('[data-device-id="start-5"] .sandbox-operate');
    await state(page,'motor-9','RUNNING');
    await page.click('[data-device-id="start-5"] .sandbox-operate'); // release

    // A direct *downstream* short triggers the actual breaker on the next scan.
    await button(page,'Pause');
    await wire(page,'breaker-2.OUT','supply-1.M0');
    await page.waitForFunction(()=>document.querySelectorAll('.sandbox-wire-list > div').length===17);
    await button(page,'▶ Run');
    await page.waitForFunction(()=>document.querySelector('[data-breaker-status]')?.textContent==='TRIPPED');
    await state(page,'motor-9','STOPPED');

    await button(page,'Pause');
    await button(page,'Reset protection');
    await page.waitForFunction(()=>document.querySelector('.sandbox-alert')?.textContent.includes('Remove the short circuit'));
    assert.equal(await page.$eval('[data-breaker-status]',el=>el.textContent),'TRIPPED');
    const removed=await page.evaluate(()=>{
      const row=[...document.querySelectorAll('.sandbox-wire-list > div')].find(el=>
        el.textContent.includes('breaker-2.OUT') && el.textContent.includes('supply-1.M0'));
      const remove=row?.querySelector('button');
      if(remove && !remove.disabled) remove.click();
      return !!remove && !remove.disabled;
    });
    assert.ok(removed,'Expected removable actual downstream short wire');
    await page.waitForFunction(()=>document.querySelectorAll('.sandbox-wire-list > div').length===16);
    await button(page,'Reset protection');
    await page.waitForFunction(()=>document.querySelector('[data-breaker-status]')?.textContent==='CLOSED');
    await button(page,'▶ Run');
    await page.click('[data-device-id="start-5"] .sandbox-operate');
    await state(page,'motor-9','RUNNING');
    await state(page,'lamp-10','ILLUMINATED');
    assert.deepEqual(errors,[]);
    console.log('P4 PANEL BROWSER PASS: 16-wire real DOL, meter, overload, latching training E-stop, short reset refusal and recovery');
  }finally{await browser.close()}
})().catch(error=>{console.error('P4 PANEL BROWSER FAIL',error.stack||String(error));process.exitCode=1});
