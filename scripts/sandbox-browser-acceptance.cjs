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
  // The sticky toolbar covers a band of the viewport. Like a person, scroll the target to the centre
  // before clicking (Puppeteer only scrolls elements that are entirely off-screen).
  { const original = page.click.bind(page);
    page.click = async (selector, options) => {
      await page.$eval(selector, el => el.scrollIntoView({ block: 'center', inline: 'center' }));
      return original(selector, options);
    }; }
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
    await page.waitForSelector('.sandbox-3d-shell',{timeout:12000}).catch(async error=>{
      console.error('P7 STARTUP DIAGNOSTICS',JSON.stringify({
        pageErrors:errors,
        screen:await page.evaluate(()=>document.body?.innerText?.slice(0,2200)??''),
        location:page.url(),
      }));
      throw error;
    });
    try {
      await page.waitForFunction(() => !!document.querySelector('.sandbox-three-canvas canvas') ||
        !!document.querySelector('.sandbox-3d-fallback'), { timeout: 15000 });
    } catch (error) {
      const state = await page.evaluate(() => {
        const shell = document.querySelector('.sandbox-3d-shell');
        const probe = document.createElement('canvas');
        return { shellHTML: shell?.innerHTML.slice(0, 2500),
          text: document.body.innerText.slice(0, 1000),
          webgl2: !!probe.getContext('webgl2'), webgl1: !!probe.getContext('webgl') };
      });
      console.error('3D INIT DIAGNOSTICS', JSON.stringify({ state, pageErrors: errors }));
      throw error;
    }
    // The canvas starts at the browser default (300x150) until the 3D layer has measured its container.
    // Dropping onto the floor before that maps to the wrong place, so wait for the real size (no canvas,
    // as with WebGL blocked, needs no wait).
    await page.waitForFunction(() => {
      const c = document.querySelector('.sandbox-three-canvas canvas');
      return !c || c.width > 320;
    }, { timeout: 10000 }).catch(() => {});
    const renderer = await page.evaluate(() => {
      const canvas = document.querySelector('.sandbox-three-canvas canvas');
      return { hasCanvas: !!canvas, width: canvas?.width ?? 0, height: canvas?.height ?? 0,
        fallback: document.querySelector('.sandbox-3d-fallback')?.textContent?.trim() ?? null };
    });
    console.log('3D RENDERER CAPABILITY', JSON.stringify(renderer));
    // Some headless Linux runners explicitly disable WebGL. They can verify the
    // accessible controls/PLC semantics, but MUST NOT claim 3D graphics acceptance.
    const graphical3D = renderer.hasCanvas && renderer.width > 0 && renderer.height > 0;
    if (!graphical3D) {
      assert.ok(renderer.fallback?.includes('3D renderer unavailable'),
        'When WebGL is blocked, the accessible no-WebGL mode must explain why');
      console.log('3D VISUAL ACCEPTANCE NOT RUN: this headless browser lacks a WebGL context');
    } else {
      // Real drag-and-drop from the 3D palette onto the raycast workbench floor.
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
    }
    await clickText('Place starter layout');
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 6);
    // Connect the first wire from the real 3D terminal UI to the keyboard patch panel.
    if (graphical3D) {
      await page.waitForSelector('[data-scene-terminal-id="supply-1.P24"]');
      await page.$eval('[data-scene-terminal-id="supply-1.P24"]', el => el.click());
    } else await page.click('[data-terminal-id="supply-1.P24"]');
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
    await page.waitForFunction(() => [...document.querySelectorAll('.sandbox-lamps span')]
      .some(element => element.textContent.trim() === 'Run' && element.classList.contains('lit')));
    const motorStatus = await page.$eval('[data-device-id="motor-4"] .sandbox-device-status', e => e.textContent.trim());
    assert.equal(motorStatus, 'STOPPED', 'The motor must not run with disconnected PLC output wiring');
    assert.deepEqual(errors, [], 'Browser console/page errors');
    console.log('PASS: sandbox P1 ' + (graphical3D ? 'WebGL 3D + placement' : 'GPU-free patch panel') + ' → wiring → editable latch → run → stop → wrong logic → broken output wire');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
