/** R21/R22 browser acceptance: load a demonstration, select a belt, turn it with the 15 degree buttons, and see the saved project change. */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
const KEY = 'efo-open-sandbox-project-v1';
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.setViewport({ width: 1440, height: 940, deviceScaleFactor: 1 });
  const saved = () => page.evaluate(k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } }, KEY);
  const belt = async () => (await saved())?.components?.find(c => c.id === 'main');
  try {
    await page.goto(base + '/sandbox', { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-sandbox-demos]');
    await page.evaluate(() => { document.querySelector('[data-sandbox-demos]').open = true; });
    await page.$eval('[data-demo-load="sorting-factory"]', el => el.scrollIntoView({ block: 'center' }));
    await page.click('[data-demo-load="sorting-factory"]');
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length >= 6, { timeout: 15000 });
    // select the main belt through the selection list
    await page.click('[data-workspace-selection] summary');
    await page.evaluate(() => {
      const row = [...document.querySelectorAll('[data-workspace-selection] .workspace-selection-list label')].find(l => /main\s\u00b7/.test(l.textContent || ''));
      row.querySelector('input[type="checkbox"]').click();
    });
    await page.waitForSelector('[data-rotate-free="15"]:not([disabled])', { timeout: 8000 });
    assert.equal((await belt()).freeYawDeg, undefined, 'the belt starts unrotated');
    await page.click('[data-rotate-free="15"]');
    await page.waitForFunction(k => JSON.parse(localStorage.getItem(k) || '{}').components?.find(c => c.id === 'main')?.freeYawDeg === 15, { timeout: 8000 }, KEY);
    await page.click('[data-rotate-free="15"]');
    await page.waitForFunction(k => JSON.parse(localStorage.getItem(k) || '{}').components?.find(c => c.id === 'main')?.freeYawDeg === 30, { timeout: 8000 }, KEY);
    await page.click('[data-rotate-free="-15"]');
    await page.waitForFunction(k => JSON.parse(localStorage.getItem(k) || '{}').components?.find(c => c.id === 'main')?.freeYawDeg === 15, { timeout: 8000 }, KEY);
    await page.click('[data-rotate-free="-15"]');
    await page.waitForFunction(k => JSON.parse(localStorage.getItem(k) || '{}').components?.find(c => c.id === 'main')?.freeYawDeg === undefined, { timeout: 8000 }, KEY);   // back to the exact saved shape
    assert.deepEqual(errors, [], 'no page errors');
    console.log('R21/R22 FREE ROTATION BROWSER PASS: a belt turned 15, 30, 15 and back to 0 degrees from the toolbar');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
