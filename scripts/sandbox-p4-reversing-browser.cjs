/** Actual Chrome WebGL/Worker P4 reversing DOL: manually patch both NC
 * auxiliaries, verify forward/stop/reverse, two requests, E-stop and missing wire.
 * No fake UI direction values.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const base=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const wires=[
 ['supply-1.P24','breaker-2.IN'],['breaker-2.OUT','estop-3.A'],
 ['estop-3.B','plc-4.L+'],['supply-1.M0','plc-4.M'],
 ['estop-3.B','start-5.A'],['start-5.B','plc-4.I0.0'],
 ['estop-3.B','reversebutton-6.A'],['reversebutton-6.B','plc-4.I0.4'],
 ['estop-3.B','stop-7.A'],['stop-7.B','plc-4.I0.1'],
 ['supply-1.M0','forwardcontactor-8.A2'],['supply-1.M0','reversecontactor-9.A2'],
 ['plc-4.Q0.4','reversecontactor-9.21'],['reversecontactor-9.22','forwardcontactor-8.A1'],
 ['plc-4.Q0.5','forwardcontactor-8.21'],['forwardcontactor-8.22','reversecontactor-9.A1'],
 ['estop-3.B','forwardcontactor-8.13'],['estop-3.B','reversecontactor-9.13'],
 ['forwardcontactor-8.14','revmotor-10.F+'],['reversecontactor-9.14','revmotor-10.R+'],
 ['supply-1.M0','revmotor-10.M-'],
];
async function clickText(page,name) {
 const ok=await page.evaluate(x=>{const b=[...document.querySelectorAll('button')]
  .find(el=>el.textContent.trim()===x);
  if(!b||b.disabled)return false;b.click();return true;},name);
 assert.ok(ok,`Expected enabled button: ${name}`);
}
async function clickDevice(page,id) {
 await page.click(`[data-device-id="${id}"] .sandbox-operate`);
}
async function wire(page,a,b) {
 await page.click(`[data-terminal-id="${a}"]`);
 await page.waitForFunction(id=>document.querySelector(`[data-terminal-id="${id}"]`)
  ?.classList.contains('selected'),{},a);
 await page.click(`[data-terminal-id="${b}"]`);
}
async function direction(page,value) {
 await page.waitForFunction(expected=>
   document.querySelector('[data-direction]')?.textContent===expected,
   {timeout:12000},value);
}
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:[
  '--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'
 ]});
 const page=await browser.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.setViewport({width:1440,height:940,deviceScaleFactor:1});
  await page.goto(base+'/sandbox',{waitUntil:'networkidle0'});
  await page.waitForSelector('.sandbox-toolbar');
  await clickText(page,'Place reversing DOL layout');
  await page.waitForFunction(()=>document.querySelectorAll('.sandbox-device-list .sandbox-device').length===10);
  for(const [a,b] of wires)await wire(page,a,b);
  await page.waitForFunction(()=>document.querySelectorAll('.sandbox-wire-list > div').length===21);
  await clickText(page,'Load forward/reverse example');
  await page.waitForFunction(()=>document.querySelector('[data-rung-id="forward-enable"]') &&
    document.querySelector('[data-rung-id="reverse-enable"]'));
  await clickText(page,'▶ Run');
  await clickDevice(page,'start-5');
  await direction(page,'FORWARD');
  assert.equal(await page.$eval('[data-forward-contactor]',e=>e.textContent),'CLOSED');
  assert.equal(await page.$eval('[data-reverse-contactor]',e=>e.textContent),'OPEN');
  await clickDevice(page,'start-5'); // release
  // The opposite command alone cannot reverse an active latched drive.
  await clickDevice(page,'reversebutton-6');
  await new Promise(resolve=>setTimeout(resolve,300));
  assert.equal(await page.$eval('[data-direction]',e=>e.textContent),'FORWARD');
  await clickDevice(page,'reversebutton-6');
  await clickDevice(page,'stop-7'); // stop NC opens
  await direction(page,'STOPPED');
  await clickDevice(page,'stop-7'); // restore NC
  await clickDevice(page,'reversebutton-6');
  await direction(page,'REVERSE');
  assert.equal(await page.$eval('[data-reverse-contactor]',e=>e.textContent),'CLOSED');
  await clickDevice(page,'reversebutton-6'); // release
  await clickDevice(page,'start-5'); // opposite command while reverse latched
  await new Promise(resolve=>setTimeout(resolve,300));
  assert.equal(await page.$eval('[data-direction]',e=>e.textContent),'REVERSE');
  await clickDevice(page,'start-5'); // release
  await clickDevice(page,'stop-7'); await direction(page,'STOPPED'); await clickDevice(page,'stop-7');
  // Queue both physical buttons while PLC scans are PAUSED, so the first
  // worker scan sees genuinely simultaneous requests (not two clicks separated
  // by a running 50 ms scan).
  await clickText(page,'Pause');
  await page.waitForFunction(()=>[...document.querySelectorAll('.sandbox-toolbar button')]
    .some(b=>b.textContent.trim()==='▶ Run'));
  await clickDevice(page,'start-5');await clickDevice(page,'reversebutton-6');
  await clickText(page,'▶ Run');
  await page.waitForFunction(()=>[...document.querySelectorAll('.sandbox-lamps span')].some(e=>
    e.textContent.trim()==='ReverseRequest'&&e.classList.contains('lit')));
  await new Promise(resolve=>setTimeout(resolve,350));
  assert.equal(await page.$eval('[data-direction]',e=>e.textContent),'STOPPED');
  assert.equal(await page.$eval('[data-interlock]',e=>e.textContent),'NORMAL');
  await clickDevice(page,'start-5');await clickDevice(page,'reversebutton-6');
  // Emergency stop cuts actual PLC power with no fake motor state.
  await clickDevice(page,'reversebutton-6');await direction(page,'REVERSE');
  await clickText(page,'Press E-stop (training)');
  await direction(page,'STOPPED');
  await clickDevice(page,'reversebutton-6'); // release before reset
  await clickText(page,'Reset E-stop (training)');
  await direction(page,'STOPPED');
  // Remove a real NC link: safe PLC request cannot power forward coil.
  await clickText(page,'Pause');
  const removed=await page.evaluate(()=>{
    const row=[...document.querySelectorAll('.sandbox-wire-list > div')].find(el=>
      el.textContent.includes('reversecontactor-9.22') &&
      el.textContent.includes('forwardcontactor-8.A1'));
    const b=row?.querySelector('button');if(b && !b.disabled)b.click();
    return !!b && !b.disabled;
  });
  assert.ok(removed,'Should be able to disconnect actual reverse NC interlock wire');
  await page.waitForFunction(()=>document.querySelectorAll('.sandbox-wire-list > div').length===20);
  await clickText(page,'▶ Run');
  await clickDevice(page,'start-5');
  await page.waitForFunction(()=>[...document.querySelectorAll('.sandbox-lamps span')].some(e=>
    e.textContent.trim()==='Forward'&&e.classList.contains('lit')));
  await new Promise(resolve=>setTimeout(resolve,400));
  assert.equal(await page.$eval('[data-forward-contactor]',e=>e.textContent),'OPEN');
  assert.equal(await page.$eval('[data-direction]',e=>e.textContent),'STOPPED');
  assert.deepEqual(errors,[]);
  console.log('P4 REVERSING BROWSER PASS: 21 wires, real forward/stop/reverse, simultaneous inhibit, E-stop and broken NC link');
 }finally{await browser.close();}
})().catch(e=>{console.error('P4 REVERSING BROWSER FAIL',e.stack||String(e));process.exitCode=1});
