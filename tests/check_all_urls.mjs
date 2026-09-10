import { readFile } from 'node:fs/promises';

const companies = JSON.parse(await readFile('./data/companies.json', 'utf8'));

console.log(`Checking ${companies.length} companies for broken links / 404s...\n`);

async function testUrl(url) {
  if (!url) return { ok: false, status: 'NO_URL' };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: controller.signal,
      redirect: 'follow'
    });
    clearTimeout(timer);
    return { ok: res.ok, status: res.status, finalUrl: res.url };
  } catch (e) {
    return { ok: false, status: e.name === 'AbortError' ? 'TIMEOUT' : e.message };
  }
}

const issues = [];

for (const c of companies) {
  process.stdout.write(`Checking ${c.name}... `);
  const webRes = await testUrl(c.website);
  const carRes = await testUrl(c.careersUrl);

  const carOk = carRes.ok || carRes.status === 403; // Some cloudflare/cloudflare career sites return 403 to automated fetch
  const webOk = webRes.ok || webRes.status === 403;

  if (!webOk || !carOk || carRes.status === 404 || webRes.status === 404) {
    console.log(`❌ ISSUES FOUND`);
    issues.push({
      id: c.id,
      name: c.name,
      website: { url: c.website, status: webRes.status },
      careers: { url: c.careersUrl, status: carRes.status }
    });
  } else {
    console.log(`✅ OK (web: ${webRes.status}, car: ${carRes.status})`);
  }
}

console.log('\n--- SUMMARY OF ISSUES ---');
console.log(JSON.stringify(issues, null, 2));
