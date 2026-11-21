/** Real-Chrome acceptance for the six integrated demonstrations: each loads from the Demonstrations panel as an ordinary wired,
 *  programmed project, runs under the real worker, and its device states change on their own (belts, stations, collectors, PLC). */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const IDS = ['sorting-factory', 'machining-assembly', 'pneumatic-cell', 'multi-plc-factory', 'process-control', 'human-interaction'];
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.setViewport({ width: 1440, height: 940, deviceScaleFactor: 1 });
  const clickText = t => page.evaluate(x => { const b = [...document.querySelectorAll('button')].find(e => e.textContent.includes(x) && !e.disabled); if (b) b.click(); return !!b; }, t);
  const snapshotText = () => page.evaluate(() => [...document.querySelectorAll('.sandbox-device')].map(d => (d.getAttribute('data-device-id') || '') + '=' + (d.querySelector('.sandbox-device-status')?.textContent || '').trim()).join('|'));
  try {
    await page.goto(base + '/sandbox', { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-sandbox-demos]');
    assert.equal(await page.evaluate(() => document.querySelectorAll('[data-demo-card]').length), 6, 'six demonstration cards');
    let n = 0;
    for (const id of IDS) {
      n++;
      await page.evaluate(() => { const d = document.querySelector('[data-sandbox-demos]'); if (d && !d.open) d.open = true; });
      // A project is already on the floor after the first demo: the loader asks for confirmation before replacing it.
      await page.$eval(`[data-demo-load="${id}"]`, el => el.scrollIntoView({ block: 'center' }));
      await page.click(`[data-demo-load="${id}"]`);
      if (n > 1) { await page.waitForFunction(i => /Confirm/.test(document.querySelector(`[data-demo-load="${i}"]`)?.textContent || ''), { timeout: 4000 }, id); await page.click(`[data-demo-load="${id}"]`); }
      await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length >= 6, { timeout: 10000 });
      assert.ok(await clickText('▶ Run'), 'run ' + id);
      await page.waitForFunction(() => /Running|Pause/.test(document.body.textContent), { timeout: 8000 });
      await sleep(1500);
      const first = await snapshotText();
      await sleep(5000);
      const later = await snapshotText();
      assert.notEqual(first, later, id + ': device states change by themselves while it runs');
      console.log(`${n}. ${id}: loaded, ran, ${first.split('|').length} devices, states changing`);
      await clickText('Pause'); await page.waitForFunction(() => /Paused/.test(document.body.textContent), { timeout: 8000 });
    }
    assert.deepEqual(errors, [], 'no page errors: ' + errors.join('; '));
    console.log('SANDBOX DEMONSTRATIONS BROWSER PASS');
  } catch (e) { console.error(e); process.exitCode = 1; } finally { await browser.close(); }
})();
