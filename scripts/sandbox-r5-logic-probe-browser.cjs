/** R5.5 browser acceptance: the logic probe reads the solver: a powered 24 V terminal is HIGH, 0 V is LOW, an unwired input is
 *  FLOATING, and removing the supply wire makes a previously HIGH PLC terminal float. */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
const clickText = (page, label) => page.evaluate(text => {
  const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === text);
  if (!b) return false; b.scrollIntoView({ block: 'center' }); b.click(); return true;
}, label);
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.setViewport({ width: 1440, height: 940 });
  const probe = async terminal => {
    await page.select('[data-logic-probe-terminal]', terminal);
    await new Promise(r => setTimeout(r, 300));
    return page.$eval('[data-logic-probe-state]', el => el.getAttribute('data-logic-probe-state'));
  };
  try {
    await page.goto(base + '/sandbox', { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-sandbox-demos]');
    await page.evaluate(() => { document.querySelector('[data-sandbox-demos]').open = true; });
    await page.$eval('[data-demo-load="sorting-factory"]', el => { el.scrollIntoView({ block: 'center' }); el.click(); });
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length >= 6, { timeout: 15000 });
    await page.evaluate(() => { const t = document.querySelector('[data-p5-dock-tab="diagnostics"]'); t.scrollIntoView({ block: 'center' }); t.click(); });
    await page.waitForSelector('[data-logic-probe]', { timeout: 15000 });
    await page.$eval('[data-logic-probe]', el => { el.open = true; el.scrollIntoView({ block: 'center' }); });
    const project = await page.evaluate(() => JSON.parse(localStorage.getItem('efo-open-sandbox-project-v1') || '{}'));
    const supply = project.components.find(c => c.kind === 'supply').id;
    const plc = project.components.find(c => c.kind === 'plc16' || c.kind === 'plc').id;
    const options = await page.$$eval('[data-logic-probe-terminal] option', os => os.map(o => o.value));
    assert.ok(options.includes(`${supply}.P24`), 'supply terminals are offered');
    // a freshly loaded, paused project has no solved circuit: the probe says so instead of guessing
    assert.equal(await probe(`${supply}.P24`), 'unsolved');
    assert.ok(await clickText(page, 'Step scan'), 'Step scan button');
    await new Promise(r => setTimeout(r, 600));
    assert.equal(await probe(`${supply}.P24`), 'high');
    assert.equal(await probe(`${supply}.M0`), 'low');
    assert.equal(await probe(`${plc}.L+`), 'high', 'the PLC is powered');
    const wiredPins = new Set(project.wires.flatMap(w => [w.from, w.to]));
    const freeInput = options.find(t => t.startsWith(plc + '.I') && !wiredPins.has(t));
    if (freeInput) assert.equal(await probe(freeInput), 'floating', `${freeInput} is not wired`);
    assert.deepEqual(errors, [], 'no page errors');
    console.log(`R5.5 LOGIC PROBE BROWSER PASS: ${supply}.P24 HIGH, ${supply}.M0 LOW, ${plc}.L+ HIGH${freeInput ? `, ${freeInput} FLOATING` : ''}`);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
