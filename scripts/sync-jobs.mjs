#!/usr/bin/env node
/**
 * Fetches live openings from Nepal IT company career boards and writes data/jobs.json.
 * Run locally: node scripts/sync-jobs.mjs
 * Also used by GitHub Actions and (via import) mirrored in the browser fetcher.
 */
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UA =
  "NepalITJobs/1.0 (+https://github.com; aggregating public career listings)";

const TECH = [
  ["React", /\breact(?:\.js|js)?\b/i],
  ["Next.js", /\bnext(?:\.js)?\b/i],
  ["Vue", /\bvue(?:\.js|js)?\b/i],
  ["Angular", /\bangular\b/i],
  ["TypeScript", /\btypescript\b/i],
  ["JavaScript", /\bjavascript\b/i],
  ["Node.js", /\bnode(?:\.js)?\b/i],
  ["Python", /\bpython\b/i],
  ["Django", /\bdjango\b/i],
  ["Flask", /\bflask\b/i],
  ["FastAPI", /\bfastapi\b/i],
  ["Java", /\bjava\b/i],
  ["Spring", /\bspring(?:\s*boot)?\b/i],
  ["Kotlin", /\bkotlin\b/i],
  [".NET", /\b\.?net\b|\bc#\b|\bcsharp\b/i],
  ["Go", /\bgolang\b|\bgo lang\b/i],
  ["PHP", /\bphp\b/i],
  ["Laravel", /\blaravel\b/i],
  ["Ruby", /\bruby\b|\brails\b/i],
  ["Swift", /\bswift\b/i],
  ["Flutter", /\bflutter\b/i],
  ["React Native", /\breact\s*native\b/i],
  ["Android", /\bandroid\b/i],
  ["iOS", /\bios\b/i],
  ["AWS", /\baws\b|amazon web services/i],
  ["Azure", /\bazure\b/i],
  ["GCP", /\bgcp\b|google cloud/i],
  ["Docker", /\bdocker\b/i],
  ["Kubernetes", /\bkubernetes\b|\bk8s\b/i],
  ["Terraform", /\bterraform\b/i],
  ["PostgreSQL", /\bpostgres(?:ql)?\b/i],
  ["MySQL", /\bmysql\b/i],
  ["MongoDB", /\bmongodb\b/i],
  ["Redis", /\bredis\b/i],
  ["GraphQL", /\bgraphql\b/i],
  ["SQL", /\bsql\b/i],
  ["LLM", /\bllm\b|\bgpt\b|\bopenai\b|\blangchain\b/i],
  ["Machine Learning", /\bmachine learning\b|\bml\b|\bdeep learning\b/i],
  ["AI", /\bai\b|\bgenai\b|\bgenerative ai\b/i],
  ["Figma", /\bfigma\b/i],
  ["QA", /\bqa\b|\bselenium\b|\bcypress\b|\bplaywright\b/i],
];

async function fetchText(url, { json = false } = {}) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: json ? "application/json" : "*/*" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return json ? res.json() : res.text();
}

function stripHtml(html = "") {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTech(text) {
  const found = [];
  const sample = String(text).slice(0, 3500);
  for (const [name, re] of TECH) {
    if (re.test(sample) && !found.includes(name)) found.push(name);
  }
  return found;
}

function extractYears(text) {
  const m = text.match(
    /(\d+)\s*(?:\+|plus)?\s*(?:-|to|–)?\s*(\d+)?\s*\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:experience|exp)/i
  );
  if (!m) {
    const m2 = text.match(
      /(?:minimum|at least|min(?:imum)?)\s+(\d+)\s*(?:\+|plus)?\s*(?:years?|yrs?)/i
    );
    if (!m2) return { min: null, max: null, label: "Not specified" };
    const min = Number(m2[1]);
    return { min, max: null, label: `${min}+ years` };
  }
  const min = Number(m[1]);
  const max = m[2] ? Number(m[2]) : null;
  return {
    min,
    max,
    label: max ? `${min}–${max} years` : `${min}+ years`,
  };
}

function seniorityFrom(title) {
  const t = title.toLowerCase();
  if (/\bintern\b|internship|trainee|graduate/.test(t)) return "Intern / Trainee";
  if (/\bprincipal\b|\bstaff\b|\bdistinguished\b/.test(t)) return "Staff / Principal";
  if (/\barchitect\b|\bdirector\b|\bvp\b|\bhead of\b/.test(t)) return "Architect / Leadership";
  if (/\bmanager\b|\bengineering manager\b/.test(t)) return "Manager";
  if (/\blead\b|\btech lead\b/.test(t)) return "Lead";
  if (/\bsenior\b|\bsr\.?\b/.test(t)) return "Senior";
  if (/\bmid[- ]?level\b|\bintermediate\b/.test(t)) return "Mid";
  if (/\bjunior\b|\bjr\.?\b|\bassociate\b|\bfresh(er)?\b|\bentry\b/.test(t))
    return "Junior / Associate";
  return "Mid";
}

function domainFrom(title, dept) {
  const t = `${title} ${dept || ""}`.toLowerCase();
  if (/\bai\b|\bml\b|machine learning|llm|data scientist/.test(t)) return "AI / Machine Learning";
  if (/\bdata engineer|analytics|bi\b|warehouse/.test(t)) return "Data";
  if (/\bdevops|sre\b|platform|sysops|infrastructure/.test(t)) return "DevOps / Platform";
  if (/\bsecurity|soc\b|infosec|cyber/.test(t)) return "Security";
  if (/\bqa\b|quality assurance|sdet|test engineer/.test(t)) return "QA / Testing";
  if (/\bmobile|android|ios|flutter|react native/.test(t)) return "Mobile";
  if (/\bfrontend|front-end|ui engineer/.test(t)) return "Frontend";
  if (/\bbackend|back-end/.test(t)) return "Backend";
  if (/\bfull[- ]?stack/.test(t)) return "Full Stack";
  if (/\bdesign|ux\b|ui\/ux|product designer/.test(t)) return "Design";
  if (/\bproduct manager|product owner/.test(t)) return "Product";
  if (/\bproject manager|scrum|agile coach/.test(t)) return "Delivery / PM";
  if (/\bsales|business development|account/.test(t)) return "Sales / BD";
  if (/\bhr\b|talent|people|recruiter/.test(t)) return "People / HR";
  if (/\bfinance|accountant/.test(t)) return "Finance";
  if (/\bsupport|customer success/.test(t)) return "Support";
  if (dept) return dept;
  return "Engineering";
}

function workType(job) {
  if (job.hybrid) return "Hybrid";
  if (job.remote && job.onSite) return "Hybrid";
  if (job.remote) return "Remote";
  if (job.onSite) return "On-site";
  const t = `${job.title} ${job.location || ""}`.toLowerCase();
  if (/\bremote\b/.test(t)) return "Remote";
  if (/\bhybrid\b/.test(t)) return "Hybrid";
  return "On-site";
}

function employmentType(code, title) {
  const t = `${code || ""} ${title || ""}`.toLowerCase();
  if (/fulltime|full-time|full_time/.test(t)) return "Full-time";
  if (/\binternship\b|\bintern\b/.test(String(title).toLowerCase())) return "Internship";
  if (/part[- ]?time/.test(t)) return "Part-time";
  if (/contract|freelance|temporary/.test(t)) return "Contract";
  return "Full-time";
}

function nepalRelevant(location, text, forceNepal) {
  const t = `${location} ${text}`.toLowerCase();
  if (
    /\b(pune|bengaluru|bangalore|hyderabad|mumbai|chennai|gurugram|noida|india)\b/.test(
      t
    ) &&
    !/\bnepal\b|kathmandu|lalitpur/.test(t)
  ) {
    return false;
  }
  if (
    /nepal|kathmandu|lalitpur|patan|bhaktapur|pokhara|butwal|biratnagar|chitwan|pulchowk|hattisar|naxal|baneshwor|kupondole/.test(
      t
    )
  ) {
    return true;
  }
  return Boolean(forceNepal);
}

function normalize(job) {
  const raw = `${job.title} ${job.department || ""} ${stripHtml(job.description || "")} ${stripHtml(job.requirements || "")}`;
  const years = extractYears(raw);
  return {
    id: job.id,
    companyId: job.companyId,
    company: job.company,
    title: job.title,
    department: job.department || domainFrom(job.title, ""),
    domain: domainFrom(job.title, job.department || ""),
    seniority: seniorityFrom(job.title),
    experience: years,
    techStack: extractTech(`${job.title} ${job.department || ""} ${raw}`).slice(0, 8),
    employmentType: employmentType(job.employmentType || "", job.title),
    workType: workType({ ...job, rawText: raw }),
    location: job.location || "Nepal",
    postedAt: job.postedAt || null,
    deadline: job.deadline || null,
    applyUrl: job.applyUrl,
    careersUrl: job.careersUrl,
    applyEmail: job.applyEmail || null,
    applyHow: job.applyHow,
    summary: stripHtml(job.description || job.requirements || "").slice(0, 420),
    descriptionHtml: job.description || "",
    requirementsHtml: job.requirements || "",
    source: job.source,
    listingKind: isTalentPool(job.title) ? "talent-pool" : "vacancy",
  };
}

async function recruitee(company, apiUrl) {
  const data = await fetchText(apiUrl, { json: true });
  const offers = data.offers || [];
  return offers
    .filter((o) => !o.status || o.status === "published")
    .map((o) =>
      normalize({
        id: `${company.id}-${o.slug || o.id}`,
        companyId: company.id,
        company: company.name,
        title: o.title,
        department: o.department,
        description: o.description,
        requirements: o.requirements,
        location: o.location || (o.city ? `${o.city}, ${o.country}` : company.location),
        employmentType: o.employment_type_code,
        remote: o.remote,
        hybrid: o.hybrid,
        onSite: o.on_site,
        postedAt: o.published_at || o.created_at,
        applyUrl: o.careers_apply_url || o.careers_url,
        careersUrl: company.careersUrl,
        applyHow: `Apply on the ${company.name} careers portal. The posting opens their Recruitee form — attach your CV and answer the screening questions.`,
        source: "Recruitee",
      })
    )
    .filter((j) => nepalRelevant(j.location, j.summary, company.forceNepal));
}

async function workable(company, account) {
  const data = await fetchText(
    `https://apply.workable.com/api/v1/widget/accounts/${account}`,
    { json: true }
  );
  return (data.jobs || [])
    .map((o) =>
      normalize({
        id: `${company.id}-${o.shortcode || o.title}`,
        companyId: company.id,
        company: company.name,
        title: o.title,
        department: o.department,
        description: o.description,
        location:
          [o.city, o.state, o.country].filter(Boolean).join(", ") ||
          o.location ||
          company.location,
        employmentType: o.employment_type,
        remote: /remote/i.test(o.telecommuting || o.location || ""),
        postedAt: o.created_at || o.published_on,
        applyUrl: o.url || `https://apply.workable.com/${account}/j/${o.shortcode}/`,
        careersUrl: company.careersUrl,
        applyHow: `Apply via Workable on the CloudFactory careers board. Use the Apply button on the job page.`,
        source: "Workable",
      })
    )
    .filter((j) => nepalRelevant(j.location, j.summary, company.forceNepal));
}

async function bamboohr(company, subdomain) {
  const data = await fetchText(`https://${subdomain}.bamboohr.com/careers/list`, {
    json: true,
  });
  const rows = data.result || [];
  return rows
    .map((o) =>
      normalize({
        id: `${company.id}-${o.id}`,
        companyId: company.id,
        company: company.name,
        title: o.jobOpeningName,
        department: o.departmentLabel,
        description: o.jobOpeningName,
        location:
          [o.locationLabel, o.locationCity, o.locationState, o.locationCountry]
            .filter(Boolean)
            .join(", ") || company.location,
        employmentType: o.employmentStatusLabel,
        postedAt: o.datePosted || null,
        applyUrl: `https://${subdomain}.bamboohr.com/careers/${o.id}`,
        careersUrl: company.careersUrl,
        applyHow: `Open the BambooHR posting and submit your application (CV + form) on the company careers site.`,
        source: "BambooHR",
      })
    )
    .filter((j) => nepalRelevant(j.location, j.title, company.forceNepal));
}

function isTalentPool(title) {
  return /talent pool|unsolicited|connect with you|drop your|open application|speculative/i.test(
    title
  );
}

function extractF1SoftJobs(html) {
  const jobs = [];
  const re =
    /href="(https?:\/\/career\.f1soft\.com\/jobs\/[a-z0-9-]+)"[^>]*>([^<]+)</gi;
  let m;
  const seen = new Set();
  while ((m = re.exec(html))) {
    const url = m[1];
    const title = stripHtml(m[2]);
    if (seen.has(url) || /\/jobs\/?$/.test(url) || isTalentPool(title)) continue;
    seen.add(url);
    jobs.push({ url, title });
  }
  return jobs;
}

async function f1soft(company) {
  const html = await fetchText(company.careersUrl);
  const listed = extractF1SoftJobs(html);
  const details = [];
  for (const item of listed.slice(0, 40)) {
    try {
      const page = await fetchText(item.url);
      const title =
        (page.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || item.title;
      const loc =
        (page.match(/Location:<\/[^>]+>\s*([^<]+)/i) ||
          page.match(/Pulchowk[^<]{0,40}/i) ||
          [])[1] || company.location;
      const deadline = (page.match(/Deadline:\s*([^<]+)/i) || [])[1] || null;
      const descMatch = page.match(
        /<div[^>]+class="[^"]*(?:job-description|description)[^"]*"[^>]*>([\s\S]*?)<\/div>/i
      );
      details.push(
        normalize({
          id: `${company.id}-${item.url.split("/").pop()}`,
          companyId: company.id,
          company: company.name,
          title: stripHtml(title),
          department: "",
          description: descMatch ? descMatch[1] : stripHtml(page).slice(0, 2500),
          location: stripHtml(loc),
          deadline: deadline ? stripHtml(deadline) : null,
          applyUrl: item.url,
          careersUrl: company.careersUrl,
          applyEmail: company.applyEmail,
          applyHow: `Apply on ${company.careersUrl}. F1Soft Group also accepts CVs at ${company.applyEmail}.`,
          source: "F1Soft careers",
        })
      );
    } catch {
      details.push(
        normalize({
          id: `${company.id}-${item.url.split("/").pop()}`,
          companyId: company.id,
          company: company.name,
          title: item.title,
          description: "",
          location: company.location,
          applyUrl: item.url,
          careersUrl: company.careersUrl,
          applyEmail: company.applyEmail,
          applyHow: `Apply on the F1Soft careers portal or email ${company.applyEmail}.`,
          source: "F1Soft careers",
        })
      );
    }
  }
  return details;
}

async function htmlListings(company, { listRe, titleRe }) {
  const html = await fetchText(company.careersUrl);
  const jobs = [];
  const seen = new Set();
  let m;
  const re = listRe;
  while ((m = re.exec(html))) {
    const title = stripHtml(m.title ? m[m.title] : m[1]);
    const url = m.url ? m[m.url] : company.careersUrl;
    const key = title.toLowerCase();
    if (!title || seen.has(key) || title.length > 80) continue;
    seen.add(key);
    jobs.push(
      normalize({
        id: `${company.id}-${key.replace(/\W+/g, "-")}`,
        companyId: company.id,
        company: company.name,
        title,
        description: stripHtml(html).slice(0, 2000),
        location: company.location,
        applyUrl: url.startsWith("http") ? url : new URL(url, company.careersUrl).href,
        careersUrl: company.careersUrl,
        applyEmail: company.applyEmail,
        applyHow:
          company.applyHow ||
          `Apply on the company careers page${company.applyEmail ? ` or email ${company.applyEmail}` : ""}.`,
        source: "Careers page",
      })
    );
  }
  if (!jobs.length && titleRe) {
    while ((m = titleRe.exec(html))) {
      const title = stripHtml(m[1]);
      const key = title.toLowerCase();
      if (!title || seen.has(key) || title.length > 90) continue;
      seen.add(key);
      jobs.push(
        normalize({
          id: `${company.id}-${key.replace(/\W+/g, "-")}`,
          companyId: company.id,
          company: company.name,
          title,
          description: "",
          location: company.location,
          applyUrl: company.careersUrl,
          careersUrl: company.careersUrl,
          applyEmail: company.applyEmail,
          applyHow:
            company.applyHow ||
            `See openings on ${company.careersUrl}${company.applyEmail ? ` or write to ${company.applyEmail}` : ""}.`,
          source: "Careers page",
        })
      );
    }
  }
  return jobs;
}

async function parseCareersPage(company) {
  try {
    const targetUrl = company.source?.url || company.careersUrl || company.website;
    const html = await fetchText(targetUrl);
    const jobs = [];
    const seen = new Set();
    const re = /href=["']((?:https?:\/\/[^"']+|(?:\/jobs\/|\/career\/|\/careers\/|\/openings\/)[^"']*))["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = re.exec(html))) {
      const url = m[1].startsWith("http") ? m[1] : new URL(m[1], targetUrl).href;
      const title = stripHtml(m[2]).trim();
      const slug = title.toLowerCase().replace(/\W+/g, "-").replace(/^-+|-+$/g, "");
      if (!slug || seen.has(slug) || seen.has(url)) continue;
      if (/^(contact|apply|view|see|read|home|about|resume|submit|cv|back|more|learn|faq|privacy|terms|cookie|build-operate|why-join|our-process|benefits|culture|testimonials)/i.test(slug)) continue;
      seen.add(slug);
      seen.add(url);
      jobs.push(
        normalize({
          id: `${company.id}-${slug}`,
          companyId: company.id,
          company: company.name,
          title,
          location: company.location,
          applyUrl: url,
          careersUrl: company.careersUrl,
          applyEmail: company.applyEmail,
          applyHow: `Apply on the ${company.name} careers portal: ${url}`,
          source: "Careers page",
        })
      );
    }
    return jobs;
  } catch {
    return [];
  }
}

async function yarsalabs(company) {
  const depts = ["engineering", "design", "security", "content", "management", "finance"];
  const jobs = [];
  for (const dept of depts) {
    try {
      const res = await fetch(`https://www.yarsalabs.com/jobs/${dept}/`, {
        headers: { "User-Agent": UA },
      });
      if (!res.ok) continue;
      const html = await res.text();
      const match = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
      if (!match) continue;
      const data = JSON.parse(match[1]);
      const list = data.props?.pageProps?.jobs || [];
      for (const j of list) {
        if (!j.status || !j.totalJobOpenings || j.jobStatus === "Hiring Closed" || j.jobStatus === "Hiring Completed") {
          continue;
        }
        const jobUrl = `https://www.yarsalabs.com/jobs/${dept}/${j.slug}/`;
        jobs.push(
          normalize({
            id: `yarsatech-${j.slug}`,
            companyId: company.id,
            company: company.name,
            title: j.title,
            department: j.employmentUnit || dept,
            description: j.description || "",
            location: j.jobLocation ? `${j.jobLocation}, Nepal` : company.location,
            employmentType: j.employmentType || "Full-time",
            applyUrl: jobUrl,
            careersUrl: company.careersUrl,
            applyEmail: company.applyEmail,
            applyHow: `Apply on Yarsa Labs jobs portal: ${jobUrl} or submit CV via https://support.yarsalabs.com/help/4132799015`,
            source: "Yarsa Labs careers",
          })
        );
      }
    } catch (err) {
      console.error(`Yarsa Labs dept ${dept} error:`, err.message);
    }
  }
  return jobs;
}

const companies = JSON.parse(
  await readFile(join(ROOT, "data", "companies.json"), "utf8")
);

const fetchers = {
  recruitee: (c) => recruitee(c, c.source.url),
  workable: (c) => workable(c, c.source.account),
  bamboohr: (c) => bamboohr(c, c.source.subdomain),
  f1soft: (c) => f1soft(c),
  html: (c) =>
    htmlListings(c, {
      listRe: new RegExp(c.source.listRe || "$a", "gi"),
      titleRe: c.source.titleRe ? new RegExp(c.source.titleRe, "gi") : null,
    }),
  "careers-page": (c) => parseCareersPage(c),
  yarsalabs: (c) => yarsalabs(c),
};

const results = [];
const errors = [];

for (const company of companies) {
  // Skip companies flagged as directory-only (no public career API to scrape)
  if (company.directoryOnly || company.source?.kind === "none") {
    console.log(`${company.name}: directory-only, skipping`);
    continue;
  }
  try {
    const fn = fetchers[company.source.kind];
    if (!fn) throw new Error(`Unknown source kind: ${company.source.kind}`);
    const jobs = await fn(company);
    console.log(`${company.name}: ${jobs.length} jobs`);
    results.push(...jobs);
  } catch (err) {
    console.error(`${company.name}: ${err.message}`);
    errors.push({ company: company.id, error: err.message });
  }
}

results.sort((a, b) => String(b.postedAt || "").localeCompare(String(a.postedAt || "")));

const payload = {
  generatedAt: new Date().toISOString(),
  jobCount: results.length,
  companyCount: companies.length,
  errors,
  jobs: results,
};

await mkdir(join(ROOT, "data"), { recursive: true });
await writeFile(join(ROOT, "data", "jobs.json"), JSON.stringify(payload, null, 2));
console.log(`Wrote ${results.length} jobs`);
