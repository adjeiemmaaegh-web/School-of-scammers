/** Headless end-to-end proof: open interactive 3D workbench → wire real netlist → edit ladder → drive contactor/motor.
 * Run after npm install --no-save puppeteer@24.31.0 and a local vite preview.
 */
const puppeteer = require('puppeteer');
const assert = require('node:assert/strict');
const baseUrl = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
const pairs = [
  ['supply-1.P24','plc-2.L+'], ['supply-1.M0','plc-2.M'],
  ['supply-1.P24','start-5.A'], ['start-5.B','plc-2.I0.0'],
  ['supply-1.P24','stop-6.A'], ['stop-6.B','plc-2.I0.1'],
  ['plc-2.Q0.0','contactor-3.A1'], ['supply-1.M0','contactor-3.A2'],
  ['supply-1.P24','contactor-3.13'], ['contactor-3.14','motor-4.L+'], ['supply-1.M0','motor-4.M-'],
];
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  const clickText = async text => {
    const found = await page.evaluate(label => {
      const button = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === label);
      if (!button) return false;
      button.click();
      return true;
    }, text);
    assert.ok(found, `Expected control: ${text}`);
  };
  const paused = () => page.waitForFunction(() =>
    [...document.querySelectorAll('.sandbox-toolbar button')].some(b => b.textContent.trim() === '▶ Run' && !b.disabled));
  const motorIs = running => page.waitForFunction(expected =>
    document.querySelector('[data-device-id="motor-4"] .sandbox-device-status')?.textContent.trim() === expected,
    { timeout: 5000 }, running ? 'RUNNING' : 'STOPPED');
  try {
    await page.goto(baseUrl + '/sandbox', { waitUntil: 'networkidle0', timeout: 15000 });
    await page.waitForSelector('.sandbox-3d-shell');
    await page.waitForSelector('canvas.sandbox-three-canvas', { timeout: 15000 });
    const webgl = await page.evaluate(() => {
      const canvas = document.querySelector('canvas.sandbox-three-canvas');
      return !!canvas && canvas.width > 0 && canvas.height > 0 && !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
    });
    assert.ok(webgl, 'P1 must mount an actual WebGL-backed Three.js scene when software WebGL is available');
    // Drag a palette component onto the 3D floor; a projected ray must place a real project component.
    await page.evaluate(() => {
      const root = document.querySelector('.sandbox-3d-shell');
      const rect = root.getBoundingClientRect();
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', 'add:motor');
      root.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer,
        clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }));
    });
    await page.waitForSelector('[data-device-id="motor-1"]', { timeout: 5000 });
    await clickText('New blank project');
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 0);
    await clickText('Place starter layout');
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 6);
    // Connect the first wire from the real 3D terminal UI to the keyboard patch panel.
    await page.waitForSelector('[data-scene-terminal-id="supply-1.P24"]');
    await page.$eval('[data-scene-terminal-id="supply-1.P24"]', el => el.click());
    await page.waitForFunction(() => document.querySelector('[data-terminal-id="supply-1.P24"]')?.classList.contains('selected'));
    await page.click('[data-terminal-id="plc-2.L+"]');
    for (const [from, to] of pairs.slice(1)) {
      await page.click(`[data-terminal-id="${from}"]`);
      await page.waitForFunction(id => document.querySelector(`[data-terminal-id="${id}"]`)?.classList.contains('selected'), {}, from);
      await page.click(`[data-terminal-id="${to}"]`);
    }
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-wire-list > div').length === 11);
    await clickText('Load editable latch example');
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-contact').length === 3);
    await clickText('▶ Run');
    await motorIs(false);
    await page.click('[data-device-id="start-5"] .sandbox-operate');
    await motorIs(true);
    await page.click('[data-device-id="start-5"] .sandbox-operate');
    await page.waitForFunction(() => document.querySelector('[data-device-id="start-5"] .sandbox-operate')?.textContent.trim() === 'Press');
    // Advance several real worker scans. A proper seal-in stays running with Start released.
    const scanBefore = Number((await page.$eval('.sandbox-scan', node => node.textContent)).replace(/\D/g, ''));
    await page.waitForFunction(n => Number(document.querySelector('.sandbox-scan')?.textContent.replace(/\D/g, '')) >= n + 4,
      { timeout: 5000 }, scanBefore);
    assert.equal(await page.$eval('[data-device-id="motor-4"] .sandbox-device-status', el => el.textContent.trim()), 'RUNNING');
    await page.click('[data-device-id="stop-6"] .sandbox-operate');
    await motorIs(false);

    await clickText('Pause');
    await paused();
    await clickText('Reset to one contact');
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-contact').length === 1);
    await page.click('[data-device-id="stop-6"] .sandbox-operate'); // Release stop.
    await page.click('[data-device-id="start-5"] .sandbox-operate'); // Press start.
    await clickText('▶ Run');
    await motorIs(true);
    await page.click('[data-device-id="start-5"] .sandbox-operate'); // One contact cannot latch.
    await motorIs(false);

    await clickText('Pause');
    await paused();
    await clickText('Load editable latch example');
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-contact').length === 3);
    const removed = await page.evaluate(() => {
      const row = [...document.querySelectorAll('.sandbox-wire-list > div')].find(e =>
        e.querySelector('code')?.textContent.includes('plc-2.Q0.0 → contactor-3.A1'));
      if (!row) return false;
      row.querySelector('button')?.click(); return true;
    });
    assert.ok(removed, 'PLC output wire should be removable');
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-wire-list > div').length === 10);
    await page.click('[data-device-id="start-5"] .sandbox-operate');
    await clickText('▶ Run');
    await page.waitForFunction(() => document.querySelector('.sandbox-lamps span:nth-child(3)')?.classList.contains('lit'));
    const motorStatus = await page.$eval('[data-device-id="motor-4"] .sandbox-device-status', e => e.textContent.trim());
    assert.equal(motorStatus, 'STOPPED', 'The motor must not run with disconnected PLC output wiring');
    assert.deepEqual(errors, [], 'Browser console/page errors');
    console.log('PASS: sandbox P1 true 3D → palette drop → 3D terminal wiring → editable latch → run → stop → wrong logic → broken output wire');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
