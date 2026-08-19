import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:5173';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const fails = [];
const ok = (label, cond, detail = '') => {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? ' - ' + detail : ''}`);
  if (!cond) fails.push(label);
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox'],
});

const noise = [];
const watch = (p) => {
  p.on('console', (m) => {
    if (m.type() === 'error') noise.push(`console: ${m.text()}`);
  });
  p.on('pageerror', (e) => noise.push(`pageerror: ${e.message}`));
  p.on('requestfailed', (r) => noise.push(`failed: ${r.url()}`));
};

console.log('\n--- PUBLIC SITE ---');
const page = await browser.newPage();
watch(page);
await page.setViewport({ width: 1440, height: 900 });
await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await new Promise((r) => setTimeout(r, 1200));

const home = await page.evaluate(() => ({
  title: document.title,
  h1: document.querySelector('h1')?.textContent.trim(),
  sections: [...document.querySelectorAll('section[id]')].map((s) => s.id),
  projectCards: document.querySelectorAll('#portfolio li.glass-card').length,
  achievementCards: document.querySelectorAll('#achievements li').length,
  revealed: document.querySelectorAll('.reveal[data-revealed="true"]').length,
  totalReveal: document.querySelectorAll('.reveal').length,
  canonical: document.querySelector('link[rel=canonical]')?.href,
  jsonLd: Boolean(document.querySelector('script[type="application/ld+json"]')),
  skipLink: Boolean(document.querySelector('.skip-link')),
}));
ok('page title set', home.title.includes('Tanvo Tech'), home.title);
ok('hero h1 renders', Boolean(home.h1));
ok('all 6 sections present', home.sections.length === 6, home.sections.join(','));
ok('portfolio cards render', home.projectCards === 4, `${home.projectCards} cards`);
ok('achievement cards render', home.achievementCards === 4, `${home.achievementCards} cards`);
ok('scroll reveal fired', home.revealed === home.totalReveal, `${home.revealed}/${home.totalReveal}`);
ok('canonical url', Boolean(home.canonical), home.canonical);
ok('JSON-LD present', home.jsonLd);
ok('skip link present', home.skipLink);

await page.evaluate(() => window.scrollTo(0, 0));
const filtered = await page.evaluate(async () => {
  const btns = [...document.querySelectorAll('#portfolio [role=group] button')];
  const target = btns.find((b) => b.textContent.trim() === 'App Dev');
  target?.click();
  await new Promise((r) => setTimeout(r, 400));
  return {
    label: target?.textContent.trim(),
    count: document.querySelectorAll('#portfolio li.glass-card').length,
    pressed: target?.getAttribute('aria-pressed'),
  };
});
ok(
  'portfolio filter works',
  filtered.count === 1 && filtered.pressed === 'true',
  `${filtered.label} -> ${filtered.count} card`,
);

const validation = await page.evaluate(async () => {
  document.querySelector('#contact form button[type=submit]').click();
  await new Promise((r) => setTimeout(r, 300));
  return {
    invalid: document.querySelectorAll('#contact [aria-invalid="true"]').length,
    live: document.querySelector('#contact [aria-live]')?.textContent.trim(),
  };
});
ok('contact validation blocks empty submit', validation.invalid >= 2, `${validation.invalid} fields flagged`);
ok('validation announced to AT', Boolean(validation.live), validation.live);
await page.close();

console.log('\n--- ADMIN ---');
const admin = await browser.newPage();
watch(admin);
await admin.setViewport({ width: 1440, height: 900 });
await admin.goto(BASE + '/admin', { waitUntil: 'networkidle2' });
await admin.evaluate(() => sessionStorage.setItem('tanvo:intro-seen', '1'));
await admin.reload({ waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 500));

const gate = await admin.evaluate(() => ({
  noindex: document.querySelector('meta[name=robots]')?.content,
  hasPasswordField: Boolean(document.querySelector('input[type=password]')),
  configured: !document.body.innerText.includes('No password is set'),
}));
ok('/admin is noindex', (gate.noindex ?? '').includes('noindex'), gate.noindex);
ok('password field present', gate.hasPasswordField);
ok('admin password configured', gate.configured);

await admin.type('input[type=password]', 'not-the-password');
await admin.click('button[type=submit]');
await new Promise((r) => setTimeout(r, 1800));
const wrong = await admin.evaluate(() => document.body.innerText.includes('Incorrect password'));
ok('wrong password rejected', wrong);

await admin.evaluate(() => localStorage.removeItem('tanvo:admin-attempts:v1'));
await admin.reload({ waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 500));
await admin.type('input[type=password]', 'zstar@1908');
await admin.click('button[type=submit]');
await new Promise((r) => setTimeout(r, 2200));

const dash = await admin.evaluate(() => ({
  heading: document.querySelector('h1')?.textContent.trim(),
  tabs: [...document.querySelectorAll('[role=tab]')].map((t) => t.textContent.trim()),
  columns: [...document.querySelectorAll('[role=tabpanel] section')].map((s) =>
    s.getAttribute('aria-label'),
  ),
}));
ok('logged into dashboard', dash.heading === 'Content dashboard', dash.heading);
ok('three tabs render', dash.tabs.length === 3, dash.tabs.join(','));
ok('kanban columns render', dash.columns.length === 3, dash.columns.join(' | '));

const moved = await admin.evaluate(async () => {
  const col = () => document.querySelectorAll('[role=tabpanel] section:nth-of-type(1) li').length;
  const before = col();
  const btn = document.querySelector('[aria-label^="Move"][aria-label*="In Progress"]');
  const label = btn?.getAttribute('aria-label');
  btn?.click();
  await new Promise((r) => setTimeout(r, 500));
  const stored = JSON.parse(localStorage.getItem('tanvo:content:v1') ?? '{}');
  return { label, before, after: col(), persisted: Array.isArray(stored.projects) };
});
ok('project moves between columns', moved.after === moved.before - 1, `upcoming ${moved.before} -> ${moved.after}`);
ok('change persisted to storage', moved.persisted);

const achTab = await admin.evaluate(async () => {
  [...document.querySelectorAll('[role=tab]')]
    .find((t) => t.textContent.includes('Achievements'))
    ?.click();
  await new Promise((r) => setTimeout(r, 400));
  return document.querySelectorAll('[role=tabpanel] ul > li').length;
});
ok('achievements tab lists records', achTab === 4, `${achTab} records`);

const dataTab = await admin.evaluate(async () => {
  [...document.querySelectorAll('[role=tab]')]
    .find((t) => t.textContent.includes('Data'))
    ?.click();
  await new Promise((r) => setTimeout(r, 400));
  return [...document.querySelectorAll('[role=tabpanel] button')].map((b) => b.textContent.trim());
});
ok('data tools render', dataTab.some((t) => t.includes('Export')), dataTab.join(' / '));
await admin.close();

console.log('\n--- CONSOLE OUTPUT ---');
const real = noise.filter((n) => !/favicon|DevTools|Autofocus/i.test(n));
if (real.length === 0) console.log('  clean - no console errors, page errors, or failed requests');
else real.slice(0, 12).forEach((n) => console.log('  ' + n));
ok('no runtime errors', real.length === 0, `${real.length} issues`);

await browser.close();
console.log(`\n${fails.length ? 'FAILURES: ' + fails.join('; ') : 'ALL CHECKS PASSED'}\n`);
process.exit(fails.length ? 1 : 0);
