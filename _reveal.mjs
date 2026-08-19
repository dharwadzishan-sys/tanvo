import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });

const report = async (label) => {
  const r = await page.evaluate(() => {
    const all = [...document.querySelectorAll('.reveal')];
    const stuck = all
      .filter((el) => el.getAttribute('data-revealed') !== 'true')
      .map((el) => {
        const b = el.getBoundingClientRect();
        return {
          section: el.closest('section[id]')?.id ?? '?',
          cls: el.className.split(' ').slice(0, 3).join(' '),
          top: Math.round(b.top),
          opacity: getComputedStyle(el).opacity,
        };
      });
    return { total: all.length, stuck };
  });
  console.log(`\n${label}: ${r.total - r.stuck.length}/${r.total} revealed`);
  r.stuck.forEach((s) =>
    console.log(`   STUCK  [${s.section}] ${s.cls}  top=${s.top}  opacity=${s.opacity}`),
  );
  return r;
};

await new Promise((r) => setTimeout(r, 800));
await report('on load');

// Instant jump to bottom — mimics anchor nav or a fast scroll flick.
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await new Promise((r) => setTimeout(r, 1500));
await report('after instant jump to bottom');

// Now scroll smoothly back up through everything.
await page.evaluate(async () => {
  for (let y = document.body.scrollHeight; y >= 0; y -= 300) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 40));
  }
});
await new Promise((r) => setTimeout(r, 800));
await report('after scrolling back through');

await browser.close();
