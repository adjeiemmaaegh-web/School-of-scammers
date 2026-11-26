/** R6.2 browser acceptance: the 3D view switches between perspective and orthographic projection in Orbit mode, refits the
 *  plant, keeps the project unchanged, and Fly mode returns to perspective. */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
const KEY = 'efo-open-sandbox-project-v1';
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.setViewport({ width: 1440, height: 940 });
  const projection = () => page.$eval('[data-3d-projection]', el => el.getAttribute('data-3d-projection')).catch(() => null);
  const status = () => page.$eval('[data-3d-camera-status]', el => el.textContent);
  try {
    await page.goto(base + '/sandbox', { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-sandbox-demos]');
    await page.evaluate(() => { document.querySelector('[data-sandbox-demos]').open = true; });
    await page.$eval('[data-demo-load="sorting-factory"]', el => { el.scrollIntoView({ block: 'center' }); el.click(); });
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length >= 6, { timeout: 15000 });
    await page.waitForSelector('canvas', { timeout: 15000 });
    const before = await page.evaluate(k => localStorage.getItem(k), KEY);
    // Html labels must keep a sensible on-screen size in both projections (they once scaled by the orthographic zoom)
    const labelWidth = () => page.$$eval('[data-3d-drag-handle]', els => { const w = els.map(e => e.getBoundingClientRect().width).filter(x => x > 0).sort((a, b) => a - b); return w[Math.floor(w.length / 2)] ?? 0; });
    await page.waitForFunction(() => [...document.querySelectorAll('[data-3d-drag-handle]')].filter(e => e.getBoundingClientRect().width > 0).length >= 3, { timeout: 10000 });
    await new Promise(r => setTimeout(r, 400));
    const perspectiveLabel = await labelWidth();
    assert.ok(perspectiveLabel > 0, 'equipment labels are visible');
    assert.equal(await projection(), 'perspective');
    await page.$eval('[data-3d-presets]', el => { el.open = true; });
    await page.$eval('[data-3d-orthographic]', el => el.click());
    await page.waitForFunction(() => document.querySelector('[data-3d-projection]')?.getAttribute('data-3d-projection') === 'orthographic', { timeout: 8000 });
    await page.waitForSelector('canvas', { timeout: 8000 });
    assert.match(await status(), /ORTHOGRAPHIC/);
    // the canvas remounts on a projection change: wait until its labels exist again before measuring
    await page.waitForFunction(() => [...document.querySelectorAll('[data-3d-drag-handle]')].filter(e => e.getBoundingClientRect().width > 0).length >= 3, { timeout: 10000 });
    await new Promise(r => setTimeout(r, 400));
    const orthoLabel = await labelWidth();
    assert.ok(orthoLabel > perspectiveLabel * 0.4 && orthoLabel < perspectiveLabel * 2.5, `label size kept: ${perspectiveLabel.toFixed(0)} px vs ${orthoLabel.toFixed(0)} px`);
    // a preset view in orthographic still works (camera only)
    await page.$eval('[data-3d-view-preset="top"]', el => el.click());
    await new Promise(r => setTimeout(r, 400));
    assert.equal(await projection(), 'orthographic');
    // Fly mode is perspective
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Fly'); b?.click(); });
    await page.waitForFunction(() => document.querySelector('[data-3d-projection]')?.getAttribute('data-3d-projection') === 'perspective', { timeout: 8000 });
    assert.ok(await page.$eval('[data-3d-orthographic]', el => el.disabled), 'the toggle is disabled outside Orbit');
    const after = await page.evaluate(k => localStorage.getItem(k), KEY);
    assert.equal(after, before, 'changing the view never edits the project');
    assert.deepEqual(errors, [], 'no page errors');
    console.log('R6.2 ORTHOGRAPHIC BROWSER PASS: perspective -> orthographic (refit, top preset) -> Fly returns to perspective; project untouched');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
