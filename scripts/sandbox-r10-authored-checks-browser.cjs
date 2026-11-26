/** R10.2 browser acceptance: an author adds a measurable check to a running demonstration, runs it (PASS from the real tick),
 *  exports the scene package with the check, imports it again and sees the check reported in the import notice. */
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.setViewport({ width: 1440, height: 940 });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'checks-'));
  const cdp = await page.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dir });
  const click = sel => page.$eval(sel, el => { el.scrollIntoView({ block: 'center' }); el.click(); });
  try {
    await page.goto(base + '/sandbox', { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-sandbox-demos]');
    await page.evaluate(() => { document.querySelector('[data-sandbox-demos]').open = true; });
    await click('[data-demo-load="sorting-factory"]');
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length >= 6, { timeout: 15000 });
    await page.waitForSelector('[data-open-project-library]:not([disabled])', { timeout: 15000 });
    await click('[data-open-project-library]');
    await page.waitForSelector('[data-authored-checks]', { timeout: 15000 });
    // author: "Cartons reach the good bin" = good-bin.count >= 2 after 20 s
    await page.type('[data-check-label]', 'Cartons reach the good bin');
    await page.$eval('[data-check-after-s]', el => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, '20'); el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.select('[data-check-kind]', 'signal');
    await page.select('[data-check-device]', 'good-bin');
    await page.$eval('[data-check-signal]', el => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, 'count'); el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.select('[data-check-op]', '>=');
    await page.$eval('[data-check-value]', el => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, '2'); el.dispatchEvent(new Event('input', { bubbles: true })); });
    await click('[data-check-add]');
    await page.waitForSelector('[data-authored-check="0"]', { timeout: 5000 });
    await click('[data-run-checks]');
    await page.waitForSelector('[data-check-result]', { timeout: 60000 });
    const result = await page.$eval('[data-check-result]', el => ({ r: el.getAttribute('data-check-result'), t: el.textContent }));
    assert.equal(result.r, 'pass', result.t);
    assert.match(result.t, /good-bin\.count was \d+ after 20\.0 s/);
    // export the scene package and check it carries the check
    await click('[data-library-export-package]');
    let file = null;
    for (let i = 0; i < 50 && !file; i++) { await new Promise(r => setTimeout(r, 100)); file = fs.readdirSync(dir).find(f => f.endsWith('.json')); }
    assert.ok(file, 'scene package downloaded');
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    assert.equal(pkg.kind, 'efo-scene-package');
    assert.equal(pkg.checks?.[0]?.target?.device, 'good-bin');
    // import it back: the notice reports the measurable check
    const input = await page.$('[data-library-package-input]');
    await input.uploadFile(path.join(dir, file));
    await page.waitForFunction(() => /1 measurable check/.test(document.body.innerText), { timeout: 15000 });
    assert.deepEqual(errors, [], 'no page errors');
    console.log('R10.2 AUTHORED CHECKS BROWSER PASS: check authored, PASS from the real tick, exported in the scene package and re-imported');
  } finally { await browser.close(); fs.rmSync(dir, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exit(1); });
