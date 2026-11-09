/**
 * Real-Chrome numeric I/O E2E. Loads a validated saved project with a pump/tank/
 * powered PLC16, connects the numeric cable through the SAME UI as a learner,
 * and runs a learner-editable REAL Structured Text controller on the actual worker.
 *
 * This is a bounded educational engineering-unit signal, not an ADC or rated sensor.
 */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
const ST = ['VAR_INPUT', '  Analog0 : REAL;', 'END_VAR', 'VAR_OUTPUT',
  '  Out0 : BOOL;', 'END_VAR', 'Out0 := Analog0 < 250.0;'].join('\n');
const project = {
  formatVersion: 1,
  components: [
    { id: 'ps', kind: 'supply', x: 10, y: 10, pressed: false },
    { id: 'ctrl', kind: 'plc16', x: 280, y: 10, pressed: false },
    { id: 'tank', kind: 'tank', x: 800, y: 500, pressed: false },
    { id: 'pump', kind: 'pump', x: 850, y: 550, pressed: false },
  ],
  wires: [
    { id: 'power1', from: 'ps.P24', to: 'ctrl.L+' },
    { id: 'power2', from: 'ps.M0', to: 'ctrl.M' },
    { id: 'power3', from: 'ctrl.Q0.0', to: 'pump.L+' },
    { id: 'power4', from: 'ps.M0', to: 'pump.M-' },
  ],
  program: { id: 'sandbox-program', version: '1.0', rungs: [
    { id: 'rung-1', elements: [{ type: 'contact', tag: 'In0' }], coil: 'Out0' },
  ] },
  language: 'st', stSource: ST,
};
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: [
    '--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  ] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  const originalClick = page.click.bind(page);
  page.click = async (selector, options) => {
    await page.$eval(selector, el => el.scrollIntoView({ block: 'center', inline: 'center' }));
    return originalClick(selector, options);
  };
  const clickText = async label => {
    const clicked = await page.evaluate(text => {
      const button = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === text);
      if (!button || button.disabled) return false;
      button.click();
      return true;
    }, label);
    assert.ok(clicked, 'Button available: ' + label);
  };
  try {
    await page.setViewport({ width: 1440, height: 940, deviceScaleFactor: 1 });
    await page.goto(base + '/sandbox', { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate(data => {
      localStorage.clear();
      localStorage.setItem('efo-open-sandbox-project-v1', JSON.stringify(data));
    }, project);
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-device-id="ctrl"]');
    await page.waitForSelector('#sandbox-st-source');
    await page.waitForFunction(() => document.querySelector('.sandbox-st-status strong')?.textContent.trim() === 'Compiler OK',
      { timeout: 10000 });
    assert.equal(await page.$eval('.sandbox-wire-list', e => e.children.length), 4);

    // The numeric cable is placed through the patch panel, not injected via a test-only API.
    await page.click('[data-terminal-id="tank.LEVEL"]');
    await page.waitForFunction(() => document.querySelector('[data-terminal-id="tank.LEVEL"]')?.classList.contains('selected'));
    await page.click('[data-terminal-id="ctrl.AI0"]');
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-wire-list > div').length === 5);
    await page.waitForFunction(() =>
      document.querySelector('[data-analog-input="AI0"] strong')?.textContent.trim() === '0 ml');
    assert.match(await page.$eval('#sandbox-st-source', e => e.value), /Analog0 : REAL/);

    await clickText('▶ Run');
    await page.waitForFunction(() => [...document.querySelectorAll('.sandbox-toolbar button')]
      .some(b => b.textContent.trim() === 'Pause'), { timeout: 10000 });
    await page.waitForFunction(() => {
      const text = document.querySelector('[data-analog-input="AI0"] strong')?.textContent;
      return text && Number.parseFloat(text) >= 250;
    }, { timeout: 20000 });
    await page.waitForFunction(() =>
      document.querySelector('[data-device-id="pump"] .sandbox-device-status')?.textContent.trim() === 'STOPPED',
      { timeout: 10000 });
    const levelText = await page.$eval('[data-analog-input="AI0"] strong', e => e.textContent.trim());
    const level = Number.parseFloat(levelText);
    assert.ok(level >= 250 && level < 280, 'real tank process feedback should stop the pump at level threshold: ' + levelText);
    const unit = await page.$eval('[data-analog-input="AI0"]', e => e.textContent);
    assert.match(unit, /ml/);

    await clickText('Pause');
    await page.waitForFunction(() => [...document.querySelectorAll('.sandbox-toolbar button')]
      .some(b => b.textContent.trim() === '▶ Run' && !b.disabled), { timeout: 10000 });
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-wire-list > div').length === 5, { timeout: 10000 });
    assert.match(await page.$eval('#sandbox-st-source', e => e.value), /Analog0 : REAL/);
    assert.match(await page.$eval('[data-analog-input="AI0"]', e => e.textContent), /tank.LEVEL/);
    assert.deepEqual(errors.filter(e => !/favicon|WebGL|GPU stall|swiftshader/i.test(e)), []);
    console.log('ANALOG PLC BROWSER PASS: physical tank signal, ST control, 24V pump, persistence');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error('ANALOG PLC BROWSER FAIL', error.stack || String(error)); process.exitCode = 1; });
