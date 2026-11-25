/** R07/R14 browser acceptance: the inspector's Host PLC select, expansion-channel rename fields and the belt "Driven by" control, driving the saved project. */
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
  const saved = () => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
  const select = async id => {
    await page.evaluate(() => { if (!document.querySelector('[data-p5-inspector]')) [...document.querySelectorAll('button')].find(b => b.textContent === 'Inspector')?.click(); });
    await page.waitForSelector('[data-p5-inspector]', { timeout: 8000 });
    await page.$eval(`[data-device-id="${id}"] .sandbox-inspect-link`, el => { el.scrollIntoView({ block: 'center' }); el.click(); });
  };
  try {
    await page.goto(base + '/sandbox', { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-sandbox-demos]');
    await page.evaluate(() => { document.querySelector('[data-sandbox-demos]').open = true; });
    await page.$eval('[data-demo-load="sorting-factory"]', el => el.scrollIntoView({ block: 'center' }));
    await page.click('[data-demo-load="sorting-factory"]');
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length >= 6, { timeout: 15000 });
    // add an expansion module and a drive to the saved project, then reload it
    const p = await saved();
    p.components.push({ id: 'mod1', kind: 'io-di8', x: 150, y: 420, pressed: false }, { id: 'drv1', kind: 'drive', x: 250, y: 420, pressed: false });
    await page.evaluate((k, v) => localStorage.setItem(k, JSON.stringify(v)), KEY, p);
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length >= 8, { timeout: 15000 });
    // Host PLC attach
    await select('mod1');
    await page.waitForSelector('[data-module-host]', { timeout: 8000 });
    await page.select('[data-module-host]', 'plc');
    await page.waitForFunction(k => JSON.parse(localStorage.getItem(k) || '{}').ioModules?.mod1?.plc === 'plc', { timeout: 8000 }, KEY);
    // rename a channel
    await page.waitForSelector('[data-module-tag]', { timeout: 8000 });
    const tag = await page.$eval('[data-module-tag]', el => el.getAttribute('data-module-tag'));
    await page.click('[data-module-tag]', { clickCount: 3 });
    await page.type('[data-module-tag]', 'PART_AT_GATE');
    await page.keyboard.press('Enter');
    await page.waitForFunction((k, t) => JSON.parse(localStorage.getItem(k) || '{}').ioModules?.mod1?.names?.[t] === 'PART_AT_GATE', { timeout: 8000 }, KEY, tag);
    // detach again
    await page.select('[data-module-host]', '');
    await page.waitForFunction(k => !JSON.parse(localStorage.getItem(k) || '{}').ioModules?.mod1, { timeout: 8000 }, KEY);
    // mechanical link on the main belt
    await select('main');
    await page.waitForSelector('[data-mechanical-drive]', { timeout: 8000 });
    await page.select('[data-mechanical-drive]', 'drv1');
    await page.waitForFunction(k => JSON.parse(localStorage.getItem(k) || '{}').mechanicalLinks?.some(l => l.drive === 'drv1' && l.target === 'main'), { timeout: 8000 }, KEY);
    await page.select('[data-mechanical-drive]', '');
    await page.waitForFunction(k => !(JSON.parse(localStorage.getItem(k) || '{}').mechanicalLinks ?? []).some(l => l.target === 'main'), { timeout: 8000 }, KEY);
    assert.deepEqual(errors, [], 'no page errors');
    console.log('R07/R14 INSPECTOR BROWSER PASS: module attached, channel renamed, detached; belt linked to a drive and released');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
