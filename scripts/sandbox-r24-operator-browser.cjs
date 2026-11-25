/** Real-Chrome acceptance for R24: in the human-interaction demonstration the learner places the simulated operator, tells it to
 *  walk, is stopped by the closed guard door, requests access from the pushbutton station, and then walks into the zone. */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.setViewport({ width: 1440, height: 940, deviceScaleFactor: 1 });
  const pos = () => page.evaluate(() => { const m = document.querySelector('[data-sandbox-operator] summary')?.textContent.match(/at (-?\d+), (-?\d+) mm/); return m ? { x: Number(m[1]), y: Number(m[2]) } : null; });
  const until = async (fn, label, ms = 40000) => { const t0 = Date.now(); for (;;) { if (await fn()) return; if (Date.now() - t0 > ms) throw new Error('timeout: ' + label); await sleep(250); } };
  const setField = (sel, v) => page.evaluate((s, value) => { const el = document.querySelector(s); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); }, sel, String(v));
  const click = sel => page.evaluate(s => { const b = document.querySelector(s); if (b && !b.disabled) { b.click(); return true; } return false; }, sel);
  try {
    await page.goto(base + '/sandbox', { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-sandbox-demos]');
    await page.evaluate(() => { document.querySelector('[data-sandbox-demos]').open = true; document.querySelector('[data-sandbox-operator]').open = true; });
    await page.click('[data-demo-load="human-interaction"]');
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length >= 6, { timeout: 10000 });
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('▶ Run')).click());
    await setField('[data-operator-x]', 0); await setField('[data-operator-y]', -2000);
    assert.ok(await click('[data-operator-place]'), 'place the operator');
    await until(async () => !!(await pos()), 'operator placed');
    console.log('1. operator placed at', JSON.stringify(await pos()));
    await setField('[data-operator-y]', -700);
    assert.ok(await click('[data-operator-walk]'), 'walk');
    await sleep(6000);
    const blocked = await pos();
    assert.ok(blocked.y < -1200, 'the closed guard door stops the operator, got ' + JSON.stringify(blocked));
    console.log('2. the closed guard door stops the walking operator at', JSON.stringify(blocked));
    // Request access from the pushbutton station (inspector live control), wait for the door, then walk in.
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Inspector'); if (b && b.getAttribute('aria-pressed') !== 'true') b.click(); });
    assert.ok(await page.evaluate(() => { const b = document.querySelector('[data-device-id="hmi"] .sandbox-inspect-link'); if (b) { b.click(); return true; } return false; }), 'inspect station');
    await page.waitForSelector('[data-operator="startPressed"]', { timeout: 8000 });
    await page.click('[data-operator="startPressed"]');
    await sleep(5500);                                                           // coast-down delay + door travel
    assert.ok(await click('[data-operator-walk]'), 'walk again');
    await until(async () => { const p = await pos(); return p && p.y > -1000; }, 'operator inside the fence', 20000);
    console.log('3. access requested, door opened, operator walked in to', JSON.stringify(await pos()));
    assert.deepEqual(errors, [], 'no page errors: ' + errors.join('; '));
    console.log('SANDBOX R24 OPERATOR BROWSER PASS');
  } catch (e) { console.error(e); process.exitCode = 1; } finally { await browser.close(); }
})();
