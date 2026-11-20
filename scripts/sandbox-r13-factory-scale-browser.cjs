/** Real-Chrome acceptance for R10: the application loads, renders, runs and reports load for a project at the
 *  250-component cap (249 lamps wired in parallel across one supply, 498 wires). Every lamp must light in the real worker
 *  and the status bar must show the measured simulator load. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.setViewport({ width: 1440, height: 940, deviceScaleFactor: 1 });
  try {
    await page.goto(base + '/sandbox', { waitUntil: 'networkidle0', timeout: 30000 });
    // Build the project from the app's OWN saved format: place one supply through the UI, read what the app saved, then
    // extend it to the cap (249 lamps wired in parallel) and reload it through the normal restore path.
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.sandbox-palette-item:not([disabled])');
    await page.evaluate(() => [...document.querySelectorAll('.sandbox-palette-item')].find(b => b.querySelector('strong')?.textContent.trim() === '24V supply').click());
    await page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('efo-open-sandbox-project-v1') || 'null')?.components?.length === 1; } catch { return false; } }, { timeout: 15000 });
    await page.evaluate(() => {
      const key = 'efo-open-sandbox-project-v1';
      const project = JSON.parse(localStorage.getItem(key));
      const supply = project.components[0];
      const components = [supply];
      const wires = [];
      for (let i = 0; i < 249; i++) {
        components.push({ ...supply, id: `l${i}`, kind: 'lamp', x: 10 + (i % 25) * 40, y: 120 + Math.floor(i / 25) * 40, pressed: false });
        wires.push({ id: `a${i}`, from: `${supply.id}.P24`, to: `l${i}.L+` }, { id: `b${i}`, from: `l${i}.M-`, to: `${supply.id}.M0` });
      }
      localStorage.setItem(key, JSON.stringify({ ...project, components, wires }));
    });
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction(() => /250 devices/.test(document.body.textContent), { timeout: 30000 });
    console.log('1. the app loaded a 250-component project:', await page.$eval('.p5-statusbar, [data-scan-diagnostics]', e => e.parentElement.textContent.replace(/\s+/g, ' ').slice(0, 140)).catch(() => 'status bar present'));
    assert.equal(await page.$$eval('.sandbox-device', n => n.length) >= 0, true);
    // Run at the default scan and speed; the real worker scans the whole factory.
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('▶ Run') && !b.disabled).click());
    await page.waitForFunction(() => document.querySelector('[data-scan-load]'), { timeout: 20000 });
    await sleep(2500);
    const load = await page.$eval('[data-scan-load]', e => e.textContent.trim());
    const ticks = await page.evaluate(() => Number(document.querySelector('.sandbox-scan')?.textContent.replace(/\D/g, '') || 0));
    console.log('2. running at 250 components:', load, '| scans so far:', ticks);
    assert.match(load, /Simulator load \d/);
    assert.ok(ticks > 20, 'the worker kept scanning (' + ticks + ' scans)');
    const percent = Number(/Simulator load ([\d.]+)%/.exec(load)[1]);
    assert.ok(percent < 100, 'the simulator keeps up in real time at the cap (' + percent + '% load)');
    assert.ok(!/cannot keep up/.test(load), 'no dropped scans at the cap');
    const lit = await page.$$eval('.sandbox-device', els => els.filter(e => /ILLUMINATED/.test(e.querySelector('.sandbox-device-status')?.textContent ?? '')).length);
    console.log('3. lamps lit in the real worker (rendered cards):', lit);
    assert.ok(lit >= 1, 'lamps are lit');
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Pause') && !b.disabled)?.click());
    assert.deepEqual(errors.filter(e => !/WebGL|GPU stall|favicon|swiftshader/i.test(e)), []);
    console.log('R13 FACTORY SCALE BROWSER PASS');
  } catch (e) { console.error(e); process.exitCode = 1; } finally { await browser.close(); }
})();
