import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--no-sandbox'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto('http://localhost:5173/#contact', { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 1600));

const state = await page.evaluate(() => {
  const all = [...document.querySelectorAll('.reveal')];
  const visible = all.filter((el) => Number(getComputedStyle(el).opacity) > 0.9).length;
  return {
    prefersReduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    htmlHasRevealReady: document.documentElement.classList.contains('js-reveal-ready'),
    scrollY: Math.round(window.scrollY),
    total: all.length,
    withAttr: all.filter((el) => el.getAttribute('data-revealed') === 'true').length,
    visuallyVisible: visible,
    introPresent: Boolean(document.querySelector('.intro')),
  };
});
console.log('\nlanding on /#contact:');
console.log(JSON.stringify(state, null, 2));

await page.evaluate(async () => {
  for (let y = window.scrollY; y >= 0; y -= 250) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 30));
  }
});
await new Promise((r) => setTimeout(r, 800));

const after = await page.evaluate(() => {
  const all = [...document.querySelectorAll('.reveal')];
  return {
    withAttr: all.filter((el) => el.getAttribute('data-revealed') === 'true').length,
    visuallyVisible: all.filter((el) => Number(getComputedStyle(el).opacity) > 0.9).length,
    total: all.length,
  };
});
console.log('\nafter scrolling back to top:');
console.log(JSON.stringify(after, null, 2));

await browser.close();
