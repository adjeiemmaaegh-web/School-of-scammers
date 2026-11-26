/** R5.5/R8.1 browser acceptance: the process trend records real worker values from a running demonstration, draws them,
 *  shows the live value and saves a CSV whose last row matches the displayed value. */
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trend-'));
  const cdp = await page.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dir });
  try {
    await page.goto(base + '/sandbox', { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-sandbox-demos]');
    await page.evaluate(() => { document.querySelector('[data-sandbox-demos]').open = true; });
    await page.$eval('[data-demo-load="sorting-factory"]', el => { el.scrollIntoView({ block: 'center' }); el.click(); });
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length >= 6, { timeout: 15000 });
    // open the diagnostics dock, then the trend
    await page.evaluate(() => { const t = document.querySelector('[data-p5-dock-tab="diagnostics"]'); t.scrollIntoView({ block: 'center' }); t.click(); });
    await page.waitForSelector('[data-trend-panel]', { timeout: 15000 });
    await page.$eval('[data-trend-panel]', el => { el.open = true; el.scrollIntoView({ block: 'center' }); });
    // choose a plant signal that changes while the line runs (a belt's speed or position), else the first numeric plant signal
    const pick = await page.$eval('[data-trend-select="0"]', sel => {
      const opts = [...sel.options].map(o => o.value).filter(v => v.startsWith('plant:'));
      return opts.find(v => /main:(speed|positionMm|moving)/.test(v)) ?? opts[0];
    });
    assert.ok(pick, 'a plant signal is offered');
    await page.select('[data-trend-select="0"]', pick);
    // and a PLC output as the second series
    await page.waitForSelector('[data-trend-select="1"]');
    const plcOut = await page.$eval('[data-trend-select="1"]', sel => [...sel.options].map(o => o.value).find(v => /^plc:.*:out:/.test(v)));
    if (plcOut) await page.select('[data-trend-select="1"]', plcOut);
    // run the plant and let samples accumulate
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^(Run|▶ Run|Run simulation)$/.test(x.textContent.trim())); b?.click(); });
    await page.waitForFunction(() => /(\d+) scans/.test(document.querySelector('[data-trend-panel] summary')?.textContent || '') &&
      Number(/(\d+) scans/.exec(document.querySelector('[data-trend-panel] summary').textContent)[1]) >= 20, { timeout: 30000 });
    await page.waitForSelector('[data-trend-series]', { timeout: 10000 });
    const lines = await page.$$eval('[data-trend-series]', ps => ps.map(p => p.getAttribute('points').split(' ').length));
    assert.ok(lines.some(n => n >= 2), 'a series is drawn');
    // pause so the value stops changing, then save the CSV and compare with the displayed value
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^(Pause|⏸ Pause)$/.test(x.textContent.trim())); b?.click(); });
    await new Promise(r => setTimeout(r, 800));
    const shown = await page.$eval(`[data-trend-value="${pick}"]`, el => el.textContent.trim().split(' ')[0]);
    await page.click('[data-trend-csv]');
    let file = null;
    for (let i = 0; i < 40 && !file; i++) { await new Promise(r => setTimeout(r, 100)); file = fs.readdirSync(dir).find(f => f.endsWith('.csv')); }
    assert.ok(file, 'a CSV was saved');
    const rows = fs.readFileSync(path.join(dir, file), 'utf8').replace(/^﻿/, '').trim().split('\n');
    assert.match(rows[0], /^time_ms,scan,/);
    assert.ok(rows.length >= 21, 'one row per recorded scan');
    const last = rows[rows.length - 1].split(',');
    if (shown !== '—') assert.equal(String(Math.round(Number(last[2]) * 1000) / 1000), shown, 'CSV and display agree');
    assert.deepEqual(errors, [], 'no page errors');
    console.log(`R5.5 TREND BROWSER PASS: ${pick}${plcOut ? ' and ' + plcOut : ''} recorded over ${rows.length - 1} scans, drawn and saved as CSV`);
  } finally { await browser.close(); fs.rmSync(dir, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exit(1); });
