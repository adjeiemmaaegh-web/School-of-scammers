/** Real-Chrome check of the offline update protocol (R2.6): a newer build waits instead of replacing the running
 *  tab, the page offers a reload, accepting it activates the new build, and the saved project survives.
 *  The "new build" is simulated by changing the byte content and cache version of dist/sw.js in place (restored after). */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
const swPath = path.join(__dirname, '..', 'dist', 'sw.js');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const original = fs.readFileSync(swPath, 'utf8');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await page.goto(base + '/sandbox', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.sandbox-palette-item:not([disabled])', { timeout: 20000 });
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller || true);
    await page.reload({ waitUntil: 'networkidle0' }); // now controlled by the first worker
    await page.waitForSelector('.sandbox-palette-item:not([disabled])', { timeout: 20000 });
    assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller), 'page is controlled by the installed worker');
    await page.evaluate(() => [...document.querySelectorAll('.sandbox-palette-item')].find(b => b.querySelector('strong')?.textContent.trim() === '24V supply').click());
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 1);
    await sleep(600);
    const oldCache = await page.evaluate(async () => (await caches.keys()).filter(k => k.startsWith('plc-skills-lab-shell-')));
    assert.equal(oldCache.length, 1);
    assert.equal(await page.$('[data-sw-update]'), null, 'no banner before an update exists');

    // "Deploy" a new build: different bytes and cache version.
    fs.writeFileSync(swPath, original.replace(/const VERSION="[^"]+"/, 'const VERSION="r2-test-new-build"') + '\n// simulated new build\n');
    await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
    await page.waitForSelector('[data-sw-update]', { timeout: 20000 });
    // Waiting, not active: the running tab still has its old cache and its project is untouched.
    const during = await page.evaluate(async () => ({ keys: (await caches.keys()).filter(k => k.startsWith('plc-skills-lab-shell-')), devices: document.querySelectorAll('.sandbox-device').length }));
    assert.equal(during.devices, 1);
    assert.ok(during.keys.includes(oldCache[0]), 'the running build keeps its cache until the user updates');
    console.log('A. a newer build waits and the page offers a reload (old cache kept)');

    await page.evaluate(() => document.querySelector('[data-sw-update-apply]').click());
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => undefined);
    await page.waitForSelector('.sandbox-palette-item:not([disabled])', { timeout: 20000 });
    await page.waitForFunction(async () => (await caches.keys()).some(k => k.endsWith('r2-test-new-build')), { timeout: 20000 });
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 1, { timeout: 10000 });
    assert.equal(await page.$('[data-sw-update]'), null);
    console.log('B. accepting the update activates the new build and the saved project survives');
    console.log('Offline update browser E2E PASS');
  } finally {
    fs.writeFileSync(swPath, original);
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
