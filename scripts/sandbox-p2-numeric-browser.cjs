/** P2 numeric LD browser acceptance: verify a typed INT, ADD and comparison control actual wired motor. */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
const pairs = [
  ['supply-1.P24','plc-2.L+'], ['supply-1.M0','plc-2.M'],
  ['supply-1.P24','start-5.A'], ['start-5.B','plc-2.I0.0'],
  ['supply-1.P24','stop-6.A'], ['stop-6.B','plc-2.I0.1'],
  ['plc-2.Q0.0','contactor-3.A1'], ['supply-1.M0','contactor-3.A2'],
  ['supply-1.P24','contactor-3.13'], ['contactor-3.14','motor-4.L+'],
  ['supply-1.M0','motor-4.M-'],
];
async function clickText(page,label) {
  const found=await page.evaluate(text => {
    const button=[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===text);
    if(button)button.click();return !!button;
  },label);
  assert.ok(found,`Missing button: ${label}`);
}
const waitValue = (page,selector,value) => page.waitForFunction((query, expected) =>
  document.querySelector(query)?.value === expected,{},selector,value);
async function setNativeInput(page,selector,value) {
  await page.$eval(selector,(element,newValue)=>{
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    setter.call(element,newValue);
    element.dispatchEvent(new Event('input',{bubbles:true}));
  },value);
  await waitValue(page,selector,value);
}
(async () => {
  const browser=await puppeteer.launch({headless:true,args:[
    '--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'
  ]});
  const page=await browser.newPage();
  // The sticky toolbar covers a band of the viewport. Like a person, scroll the target to the centre
  // before clicking (Puppeteer only scrolls elements that are entirely off-screen).
  { const original = page.click.bind(page);
    page.click = async (selector, options) => {
      await page.$eval(selector, el => el.scrollIntoView({ block: 'center', inline: 'center' }));
      return original(selector, options);
    }; }
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  try {
    await page.goto(base+'/sandbox',{waitUntil:'networkidle0'});
    await page.waitForSelector('.sandbox-palette');
    await clickText(page,'Place starter layout');
    await page.waitForFunction(()=>document.querySelectorAll('.sandbox-patch .sandbox-device').length===6);
    for(const [from,to] of pairs){
      await page.click(`[data-terminal-id="${from}"]`);
      await page.waitForFunction(pin=>document.querySelector(`[data-terminal-id="${pin}"]`)?.classList.contains('selected'),{},from);
      await page.click(`[data-terminal-id="${to}"]`);
    }
    await page.waitForFunction(()=>document.querySelectorAll('.sandbox-wire-list > div').length===11);
    await page.select('select[aria-label="New PLC tag type"]','INT');
    await page.type('#sandbox-new-tag','Count');
    await setNativeInput(page,'input[aria-label="New numeric tag initial value"]','0');
    await clickText(page,'Add tag');
    await page.waitForFunction(()=>[...document.querySelectorAll('.sandbox-symbol-list code')].some(el=>el.textContent==='Count'));
    // Rung 1 drives a dummy BOOL while ADD accumulates an INT counter per scan.
    await page.select('[data-rung-id="rung-1"] select[aria-label="Output coil"]','Unused');
    await waitValue(page,'[data-rung-id="rung-1"] select[aria-label="Output coil"]','Unused');
    await page.select('select[aria-label="Instruction for rung-1"]','add');
    await page.waitForSelector('select[aria-label="Numeric destination tag"]');
    await waitValue(page,'select[aria-label="Numeric destination tag"]','Count');
    await clickText(page,'+ Add rung');
    await page.waitForFunction(()=>document.querySelectorAll('.sandbox-rung').length===2);
    await page.select('[data-rung-id="rung-2"] select[aria-label="Output coil"]','Run');
    await waitValue(page,'[data-rung-id="rung-2"] select[aria-label="Output coil"]','Run');
    await page.select('[data-rung-id="rung-2"] select[aria-label="Contact tag"]','StopOK');
    await waitValue(page,'[data-rung-id="rung-2"] select[aria-label="Contact tag"]','StopOK');
    await page.select('select[aria-label="Instruction for rung-2"]','compare');
    await page.waitForFunction(()=>document.querySelectorAll('.sandbox-numeric-instruction').length===2);
    const compare='.sandbox-rung-wrap:nth-of-type(2) .sandbox-numeric-instruction';
    await page.select(`${compare} select[aria-label="Left operand source"]`,'tag:Count');
    await page.select(`${compare} select[aria-label="Comparison operator"]`,'ge');
    await setNativeInput(page,`${compare} input[aria-label="Right operand constant"]`,'3');
    await clickText(page,'▶ Run');
    await page.click('[data-device-id="start-5"] .sandbox-operate');
    await page.waitForFunction(()=>document.querySelector('[data-device-id="motor-4"] .sandbox-device-status')?.textContent==='RUNNING',{timeout:7000});
    const count=await page.evaluate(()=>{
      const row=[...document.querySelectorAll('.sandbox-monitor-table [role="row"]')].find(row=>row.querySelector('code')?.textContent==='Count');
      return Number(row?.querySelector('strong')?.textContent);
    });
    assert.ok(count>=3,`Expected real INT register to increment past 3, found ${count}`);
    const rows=await page.$$('.sandbox-scan-history-list [role="row"]');
    assert.ok(rows.length>3,'Real worker scan history should be populated');
    await clickText(page,'Pause');
    await page.waitForFunction(()=>!![...document.querySelectorAll('.sandbox-toolbar button')].find(b=>b.textContent.trim()==='▶ Run'));
    // Alter the comparator: a threshold of 1000 must suppress the motor, not simply redraw its model.
    await setNativeInput(page,`${compare} input[aria-label="Right operand constant"]`,'1000');
    await clickText(page,'▶ Run');
    await page.waitForFunction(() =>
      Number(document.querySelector('.sandbox-scan')?.textContent.replace(/\D/g,'')) >= 8,
      { timeout: 7000 });
    await page.waitForFunction(()=>document.querySelector('[data-device-id="motor-4"] .sandbox-device-status')?.textContent==='STOPPED',{timeout:7000});
    assert.deepEqual(errors,[]);
    console.log('P2 NUMERIC BROWSER PASS: editable INT/ADD/COMPARE directly governs wired 3D motor');
  } finally {await browser.close();}
})().catch(error=>{console.error('P2 NUMERIC BROWSER FAIL',error.stack||String(error));process.exitCode=1;});
