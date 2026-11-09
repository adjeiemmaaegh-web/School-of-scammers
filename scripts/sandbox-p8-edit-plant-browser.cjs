/** Real-Chrome P8 workflow: build and reshape a plant like a bench. Add pre-wired starter panels (they
 *  work immediately), fill the floor, remove a device and see its wires go, undo it, delete the FIRST
 *  PLC and see the next one take over, use the Delete key, and reload. Values come from worker-driven DOM.
 */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: [
    '--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--use-gl=angle',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  // The ready-made starters live in a menu: open it, then choose, as a person would.
  const starter = async selector => { await page.click('[data-starters] > summary'); await page.waitForSelector(`${selector}`, { visible: true }); await page.click(selector); };
  const clickText = async text => {
    const ok = await page.evaluate(label => {
      const b = [...document.querySelectorAll('button')].find(el => el.textContent.trim() === label);
      if (!b || b.disabled) return false; b.click(); return true;
    }, text);
    assert.ok(ok, `Expected enabled button: ${text}`);
  };
  const counts = () => page.evaluate(() => ({
    devices: document.querySelectorAll('.sandbox-device').length,
    wires: document.querySelectorAll('.sandbox-wire-list > div').length,
    tabs: document.querySelectorAll('[data-plc-tab]').length,
  }));
  const waitCounts = async (devices, wires) => {
    try {
      await page.waitForFunction((d, w) =>
        document.querySelectorAll('.sandbox-device').length === d && document.querySelectorAll('.sandbox-wire-list > div').length === w,
        { timeout: 8000 }, devices, wires);
    } catch (e) {
      throw new Error(`Expected ${devices} devices / ${wires} wires but the page has ${JSON.stringify(await counts())}; alert: ${await alertText()}`);
    }
  };
  const status = (id, want, timeout = 9000) => page.waitForFunction((dev, expected) =>
    document.querySelector(`[data-device-id="${dev}"] .sandbox-device-status`)?.textContent.trim() === expected,
    { timeout }, id, want);
  const statusNow = id => page.$eval(`[data-device-id="${id}"] .sandbox-device-status`, e => e.textContent.trim());
  const toggle = id => page.click(`[data-device-id="${id}"] .sandbox-operate`);
  const paused = () => page.waitForFunction(() => [...document.querySelectorAll('.sandbox-toolbar button')]
    .some(b => b.textContent.trim() === '▶ Run' && !b.disabled), { timeout: 7000 });
  const alertText = () => page.$eval('[role="alert"].sandbox-alert', e => e.textContent).catch(() => '');
  try {
    await page.setViewport({ width: 1440, height: 940, deviceScaleFactor: 1 });
    await page.goto(base + '/sandbox', { waitUntil: 'networkidle0', timeout: 20000 });
    await page.waitForSelector('[data-starters]');
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-starters]');

    // 1. One click gives a complete, wired, programmed starter. No manual wiring or programming.
    await starter('[data-add-panel]');
    await waitCounts(6, 11);
    assert.equal((await counts()).tabs, 0, 'A single PLC shows no PLC tabs');
    await clickText('▶ Run');
    await toggle('start-1');
    await status('motor-1', 'RUNNING');
    await toggle('start-1');
    await sleep(600);
    assert.equal(await statusNow('motor-1'), 'RUNNING', 'The template program latches');
    // The sticky toolbar must stay clickable after scrolling (it once slid behind the sticky app header).
    assert.ok(await page.evaluate(() => scrollY) > 100, 'The page scrolled when a device button was pressed');
    console.log('P5 toolbar occlusion diagnostic',JSON.stringify(await page.evaluate(()=>{
      const b=[...document.querySelectorAll('.sandbox-toolbar button')].find(b=>b.textContent.trim()==='Import JSON');
      const r=b?.getBoundingClientRect();
      const element=r&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
      return {scrollY,viewport:innerWidth,toolbarTop:document.querySelector('.sandbox-toolbar')?.getBoundingClientRect().top,
        appHeaderHeight:document.querySelector('.app-header')?.getBoundingClientRect().height,
        cssHeader:document.documentElement.style.getPropertyValue('--app-header-h'),
        importRect:r&&{x:r.x,y:r.y,width:r.width,height:r.height},
        covering:element&&{tag:element.tagName,cls:element.className,text:element.textContent?.slice(0,100)},
        starterOpen:document.querySelector('[data-starters]')?.open};
    })));
    assert.equal(await page.evaluate(() => {
      const hidden = [...document.querySelectorAll('.sandbox-toolbar button')].filter(b => !b.closest('details:not([open])')).filter(b => {
        const r = b.getBoundingClientRect();
        const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return top !== b && !b.contains(top);
      });
      return hidden.map(b => b.textContent.trim());
    }).then(list => list.join('|')), '', 'No toolbar button may be covered by the app header');
    // The sticky toolbar stays a single short row now that the presets are in the Starters menu.
    assert.ok(await page.$eval('.sandbox-toolbar', e => e.getBoundingClientRect().height) < 80, 'The toolbar fits one row at 1440 px');
    // Edits are blocked while running, including Remove and Add.
    assert.equal(await page.$eval('[data-device-id="motor-1"] [data-remove-device]', b => b.disabled), true);
    assert.equal(await page.$eval('[data-add-panel]', b => b.disabled), true);
    await clickText('Pause'); await paused();

    // 2. A second panel is a second PLC with its own program; the two run independently.
    await starter('[data-add-panel]');
    await waitCounts(12, 22);
    await page.waitForSelector('[data-plc-tab="plc-2"]');
    await clickText('Reset scan state');
    await clickText('▶ Run');
    await toggle('start-2');
    await status('motor-2', 'RUNNING');
    assert.equal(await statusNow('motor-1'), 'STOPPED');
    await clickText('Pause'); await paused();

    // 3. The floor holds four panels; the fifth is refused with a clear message.
    await starter('[data-add-panel]'); await waitCounts(18, 33);
    await starter('[data-add-panel]'); await waitCounts(24, 44);
    await starter('[data-add-panel]');
    await page.waitForFunction(() => /No free space/.test(document.querySelector('[role="alert"].sandbox-alert')?.textContent ?? ''), { timeout: 5000 });
    assert.deepEqual(await counts(), { devices: 24, wires: 44, tabs: 4 });
    // A refused add leaves no undo point behind: undo goes back to three panels, not to a no-op.
    await page.click('[data-undo]'); await waitCounts(18, 33);
    await page.click('[data-undo]'); await waitCounts(12, 22);
    await starter('[data-add-panel]'); await waitCounts(18, 33);
    await page.click('[data-undo]'); await waitCounts(12, 22);

    // 4. Remove a motor: it goes, with exactly its two wires. The rest of the plant still works.
    await page.click('[data-device-id="motor-2"] [data-remove-device]');
    await waitCounts(11, 20);
    assert.equal(await page.$('[data-device-id="motor-2"]'), null);
    await clickText('Reset scan state');
    await clickText('▶ Run');
    await toggle('start-1');
    await status('motor-1', 'RUNNING');
    await clickText('Pause'); await paused();

    // 5. Undo brings it back with its wires.
    await page.click('[data-undo]');
    await waitCounts(12, 22);
    await page.waitForSelector('[data-device-id="motor-2"]');

    // 6. Delete the FIRST PLC: the next one becomes first and still runs its program.
    await page.click('[data-device-id="plc-1"] [data-remove-device]');
    await waitCounts(11, 17); // plc-1 had five wires
    assert.equal(await page.$('[data-plc-tab="plc-1"]'), null);
    assert.equal((await counts()).tabs, 0, 'One PLC left, so no tabs');
    await clickText('Reset scan state');
    await clickText('▶ Run');
    await toggle('start-2');
    await status('motor-2', 'RUNNING');
    await toggle('start-2');
    await sleep(600);
    assert.equal(await statusNow('motor-2'), 'RUNNING', 'plc-2 kept its latch after becoming the first PLC');
    await clickText('Pause'); await paused();

    // 7. The Delete key removes the selected device.
    await page.click('[data-device-id="stop-2"] .sandbox-inspect-link');
    await page.keyboard.press('Delete');
    await waitCounts(10, 15);
    assert.equal(await page.$('[data-device-id="stop-2"]'), null);

    // 8. The edited plant survives a reload.
    await page.reload({ waitUntil: 'networkidle0' });
    await waitCounts(10, 15);

    // 9. Phone width: the new controls cause no horizontal scroll.
    await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 1 });
    await sleep(400);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false);
    assert.deepEqual(errors.filter(e => !/favicon|WebGL|GPU stall|swiftshader/i.test(e)), [], 'No page errors');
    console.log('P8 edit-plant browser E2E PASS');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
