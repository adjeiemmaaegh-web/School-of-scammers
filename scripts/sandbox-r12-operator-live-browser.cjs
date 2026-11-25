/** Real-Chrome acceptance for R12/R19 live operator controls: load the process-control demonstration, run it, select the
 *  pushbutton station, hold START from the inspector and watch the vessel drain; release and watch it refill. */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.setViewport({ width: 1440, height: 940, deviceScaleFactor: 1 });
  const level = () => page.evaluate(() => { const t = document.querySelector('[data-device-id="tank"]')?.textContent.match(/levelMl\s*(-?\d+(?:\.\d+)?)/); return t ? Number(t[1]) : NaN; });
  const until = async (fn, label, ms = 40000) => { const t0 = Date.now(); for (;;) { if (await fn()) return; if (Date.now() - t0 > ms) throw new Error('timeout: ' + label); await sleep(250); } };
  try {
    await page.goto(base + '/sandbox', { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-sandbox-demos]');
    await page.evaluate(() => { document.querySelector('[data-sandbox-demos]').open = true; });
    await page.click('[data-demo-load="process-control"]');
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length >= 6, { timeout: 10000 });
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('▶ Run')).click());
    await until(async () => (await level()) >= 4500, 'vessel filled by the PLC');
    console.log('1. PLC fills the vessel to its level band:', await level(), 'ml');
    // The inspector is a collapsible side panel: open it, then select the station.
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Inspector'); if (b && b.getAttribute('aria-pressed') !== 'true' && b.getAttribute('aria-expanded') !== 'true') b.click(); });
    assert.ok(await page.evaluate(() => { const b = document.querySelector('[data-device-id="hmi"] .sandbox-inspect-link'); if (b) { b.click(); return true; } return false; }), 'open the pushbutton station inspector');
    await page.waitForSelector('[data-operator="startPressed"]', { timeout: 8000 });
    const before = await level();
    await page.click('[data-operator="startPressed"]');
    await until(async () => (await level()) < before - 1200, 'vessel drains while START is held', 20000);
    console.log('2. holding START drains the vessel:', before, '->', await level());
    const low = await level();
    await page.click('[data-operator="startPressed"]');
    await until(async () => (await level()) > low + 500, 'vessel refills after release', 30000);
    console.log('3. releasing START: the PLC refills it:', low, '->', await level());
    assert.deepEqual(errors, [], 'no page errors: ' + errors.join('; '));
    console.log('SANDBOX R12 OPERATOR LIVE BROWSER PASS');
  } catch (e) { console.error(e); process.exitCode = 1; } finally { await browser.close(); }
})();
