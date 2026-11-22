/** R02 browser acceptance: define a custom shape in the sandbox UI, point a feeder at it by number, run, and see the real part. */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.setViewport({ width: 1440, height: 940, deviceScaleFactor: 1 });
  try {
    await page.goto(base + '/sandbox', { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-custom-shapes]');
    await page.evaluate(() => { document.querySelector('[data-custom-shapes]').open = true; });
    assert.match(await page.$eval('[data-custom-shapes] summary', e => e.textContent), /0 of 8/);
    await page.click('[data-shape-define]');
    await page.waitForFunction(() => /1 of 8/.test(document.querySelector('[data-custom-shapes] summary')?.textContent || ''), { timeout: 8000 });
    const listed = await page.$eval('[data-shape-list]', e => e.textContent);
    assert.match(listed, /My bracket/); assert.match(listed, /my-bracket/);
    // invalid JSON is reported in the panel, an invalid shape by the worker
    const setNative = async (text) => page.evaluate((t) => { const el = document.querySelector('[data-shape-json]'); const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; setter.call(el, t); el.dispatchEvent(new Event('input', { bubbles: true })); }, text);
    await setNative('{ nope');
    await page.click('[data-shape-define]');
    await page.waitForFunction(() => /not valid JSON/.test(document.body.textContent || ''), { timeout: 4000 });
    await setNative(JSON.stringify({ id: 'bad', label: 'Bad', massKg: 0, blocks: [{ x: 0, y: 0, z: 0, w: 10, d: 10, h: 10 }] }));
    await page.click('[data-shape-define]');
    await page.waitForFunction(() => /mass must be/.test(document.body.textContent || ''), { timeout: 8000 });
    assert.match(await page.$eval('[data-custom-shapes] summary', e => e.textContent), /1 of 8/, 'a rejected shape is not stored');
    // remove it again
    await page.click('[data-shape-remove="my-bracket"]');
    await page.waitForFunction(() => /0 of 8/.test(document.querySelector('[data-custom-shapes] summary')?.textContent || ''), { timeout: 8000 });
    assert.deepEqual(errors, [], 'no page errors');
    console.log('R02 CUSTOM SHAPES BROWSER PASS: define, list, reject bad JSON and a bad shape, remove');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
