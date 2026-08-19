import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--no-sandbox'],
});

const check = async (url, label) => {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(url, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1500));

  // Scroll up to the top the way a visitor would after landing deep.
  await page.evaluate(async () => {
    for (let y = window.scrollY; y >= 0; y -= 250) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 30));
    }
  });
  await new Promise((r) => setTimeout(r, 700));

  const r = await page.evaluate(() => {
    const all = [...document.querySelectorAll('.reveal')];
    const stuck = all.filter((el) => el.getAttribute('data-revealed') !== 'true');
    return {
      total: all.length,
      stuck: stuck.length,
      where: stuck.map((el) => el.closest('section[id]')?.id ?? '?'),
    };
  });
  const pass = r.stuck === 0;
  console.log(
    `  ${pass ? 'PASS' : 'FAIL'}  ${label}: ${r.total - r.stuck}/${r.total} revealed` +
      (r.stuck ? `  stuck in: ${[...new Set(r.where)].join(',')}` : ''),
  );
  await page.close();
  return pass;
};

console.log('\n--- DEEP LINK / JUMP SCENARIOS ---');
const results = [];
results.push(await check('http://localhost:5173/#contact', 'land on #contact, scroll up'));
results.push(await check('http://localhost:5173/#process', 'land on #process, scroll up'));
results.push(await check('http://localhost:5173/#achievements', 'land on #achievements, scroll up'));

// End key from the top.
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 600));
await page.keyboard.press('End');
await new Promise((r) => setTimeout(r, 1500));
const endKey = await page.evaluate(
  () => document.querySelectorAll('.reveal:not([data-revealed="true"])').length,
);
console.log(`  ${endKey === 0 ? 'PASS' : 'FAIL'}  End key jump: ${endKey} stuck`);
results.push(endKey === 0);
await page.close();

await browser.close();
console.log(`\n${results.every(Boolean) ? 'ALL DEEP-LINK CHECKS PASSED' : 'FAILURES PRESENT'}\n`);
process.exit(results.every(Boolean) ? 0 : 1);
