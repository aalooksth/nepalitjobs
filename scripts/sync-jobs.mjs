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

const FOREIGN_BLACKLIST = /\b(india|united states|usa|u\.s\.a|u\.s\.|united kingdom|uk|u\.k\.|england|scotland|wales|ireland|poland|germany|canada|australia|singapore|netherlands|spain|france|italy|philippines|brazil|mexico|colombia|portugal|sweden|denmark|norway|finland|switzerland|austria|belgium|romania|bulgaria|czech|slovakia|hungary|greece|turkey|dubai|uae|saudi|qatar|japan|malaysia|vietnam|thailand|indonesia|pakistan|bangladesh|sri lanka|kenya|uganda|nigeria|south africa|pune|bengaluru|bangalore|hyderabad|mumbai|chennai|gurugram|noida|delhi|kolkata|kerala|ahmedabad|jaipur|coimbatore|kochi|indore|chandigarh|boston|new york|jersey city|chicago|austin|seattle|san francisco|california|texas|massachusetts|london|bristol|manchester|woburn|karlsruhe|oldenburg|nairobi|kampala|reading|berlin|sydney|melbourne|toronto|vancouver)\b/i;

const NEPAL_LOCATIONS = /\b(nepal|kathmandu|lalitpur|patan|bhaktapur|pokhara|butwal|biratnagar|chitwan|bharatpur|narayangarh|dharan|itahari|birgunj|nepalgunj|hetauda|dhangadhi|banepa|dhulikhel|sanepa|pulchowk|bakhundole|jhamsikhel|jawalakhel|kupondole|thamel|dillibazar|naxal|hattisar|baluwatar|baneshwor|sifal|tinkune|kamalpokhari|koteshwor|chabahil)\b/i;

function cleanNepalLocation(loc, defaultLoc = "Nepal") {
  if (!loc) return defaultLoc;
  let s = String(loc).trim();
  s = s.replace(/,?\s*Bāgmatī/gi, "");
  s = s.replace(/,?\s*Bagmati/gi, "");
  s = s.replace(/\bDistrict\b/gi, "");
  s = s.replace(/\bZone\b/gi, "");
  s = s.replace(/\s+/g, " ").trim();

  // If clearly foreign and lacks explicit Nepal marker, do NOT append Nepal
  if (FOREIGN_BLACKLIST.test(s) && !NEPAL_LOCATIONS.test(s)) return s;

  if (/pokhara/i.test(s)) return "Pokhara, Nepal";
  if (/biratnagar/i.test(s)) return "Biratnagar, Nepal";
  if (/butwal/i.test(s)) return "Butwal, Nepal";
  if (/chitwan|bharatpur|narayangarh/i.test(s)) return "Chitwan, Nepal";
  if (/dharan/i.test(s)) return "Dharan, Nepal";
  if (/itahari/i.test(s)) return "Itahari, Nepal";
  if (/hetauda/i.test(s)) return "Hetauda, Nepal";
  if (/birgunj/i.test(s)) return "Birgunj, Nepal";
  if (/nepalgunj/i.test(s)) return "Nepalgunj, Nepal";
  if (/dhangadhi/i.test(s)) return "Dhangadhi, Nepal";
  if (/banepa|dhulikhel/i.test(s)) return "Kavre, Nepal";
  if (/lalitpur|patan|sanepa|pulchowk|bakhundole|jhamsikhel|jawalakhel|kupondole/i.test(s)) return "Lalitpur, Nepal";
  if (/bhaktapur/i.test(s)) return "Bhaktapur, Nepal";
  if (/kathmandu|thamel|dillibazar|naxal|hattisar|baluwatar|baneshwor|sifal|tinkune|kamalpokhari|koteshwor|chabahil/i.test(s)) return "Kathmandu, Nepal";
  if (/remote/i.test(s)) return "Remote (Nepal)";
  if (/nepal/i.test(s)) return s.includes("Nepal") ? s : s + ", Nepal";
  return s;
}

function nepalRelevant(location, text = "", forceNepal = false) {
  const loc = String(location || "").trim();
  const t = (loc + " " + text).toLowerCase();

  if (FOREIGN_BLACKLIST.test(loc) && !/\bnepal\b/i.test(loc)) {
    return false;
  }

  if (NEPAL_LOCATIONS.test(loc)) {
    return true;
  }

  if (NEPAL_LOCATIONS.test(t) && !FOREIGN_BLACKLIST.test(t)) {
    return true;
  }

  return Boolean(forceNepal) && !FOREIGN_BLACKLIST.test(loc) && !FOREIGN_BLACKLIST.test(t);
}

function normalize(job) {
  const desc = job.descriptionHtml || job.description || "";
  const req = job.requirementsHtml || job.requirements || "";
  const raw = `${job.title} ${job.department || ""} ${stripHtml(desc)} ${stripHtml(req)}`;
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
    location: cleanNepalLocation(job.location || "Nepal"),
    postedAt: job.postedAt || null,
    deadline: job.deadline || null,
    applyUrl: job.applyUrl,
    careersUrl: job.careersUrl,
    applyEmail: job.applyEmail || null,
    applyHow: job.applyHow,
    summary: job.summary || stripHtml(desc || req || "").slice(0, 420),
    descriptionHtml: desc,
    requirementsHtml: req,
    source: job.source,
    listingKind: isTalentPool(job.title) ? "talent-pool" : "vacancy",
  };
}

function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function detectCompanyFromPage(html, defaultName) {
  if (!html) return null;
  // 1) OpenGraph / meta site_name
  const og = html.match(/<meta[^>]+property=["']og:site_name["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
             html.match(/<meta[^>]+name=["']og:site_name["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
             html.match(/<meta[^>]+name=["']twitter:site["'][^>]*content=["']([^"']+)["'][^>]*>/i);
  if (og && og[1]) {
    const v = og[1].trim();
    if (v && v.toLowerCase() !== String(defaultName || "").toLowerCase()) return v;
  }

  // 2) Look for explicit "Company: XYZ" labels
  const companyLabel = html.match(/Company:\s*<[^>]*>([^<\n]+)/i) || html.match(/Company:\s*([^<\n]+)/i);
  if (companyLabel && companyLabel[1]) {
    const v = companyLabel[1].trim();
    if (v && v.toLowerCase() !== String(defaultName || "").toLowerCase()) return v;
  }

  // 3) Look for common company/employer class or id
  const cls = html.match(/<(?:div|span|h1|h2|h3)[^>]+class=["'][^"']*(?:company|employer|org|employer-name|company-name)[^"']*["'][^>]*>([^<]+)</i);
  if (cls && cls[1]) {
    const v = cls[1].trim();
    if (v && v.toLowerCase() !== String(defaultName || "").toLowerCase()) return v;
  }

  // 4) Fallback: look for anchor with rel or title containing company-like text
  const link = html.match(/<a[^>]+class=["'][^"']*(?:company|brand|employer)[^"']*["'][^>]*>([^<]+)</i);
  if (link && link[1]) {
    const v = link[1].trim();
    if (v && v.toLowerCase() !== String(defaultName || "").toLowerCase()) return v;
  }

  return null;
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
      // Attempt to detect a child/subsidiary company name on the job page
      const detectedCompany = detectCompanyFromPage(page, company.name);
      let jobCompanyId = company.id;
      let jobCompanyName = company.name;
      if (detectedCompany && detectedCompany.toLowerCase() !== company.name.toLowerCase()) {
        jobCompanyName = detectedCompany;
        jobCompanyId = slugify(detectedCompany);
      }

      details.push(
        normalize({
          id: `${company.id}-${item.url.split("/").pop()}`,
          companyId: jobCompanyId,
          company: jobCompanyName,
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

const BLOCKED_CAREERS_HOSTS = [
  "googletagmanager.com",
  "google-analytics.com",
  "cdn.jsdelivr.net",
  "gmpg.org",
  "facebook.com",
  "instagram.com",
  "youtube.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
];

const STATIC_ASSET_RE = /\.(?:js|css|png|jpe?g|svg|webp|ico|woff2?|ttf|map)$/i;
const JOB_URL_MARKER_RE = /(^|[/.\-_])(jobs?|careers?|career|openings?|candidateportal|recruit(?:ing|ment)?|apply)([/._-]|$)/i;
const ROLE_TITLE_RE = /\b(engineer|developer|designer|analyst|manager|qa|quality assurance|sqa|devops|data|software|frontend|front-end|backend|back-end|full[-\s]?stack|product|project|scrum|officer|intern|architect|lead|sales|support|accountant|hr|recruiter|consultant|strategist|specialist)\b/i;
const GENERIC_CAREERS_TITLE_RE = /^(careers?|jobs?|openings?|company|about|our team|team|blog|case stud(?:y|ies)|sign in|sign up|join now|candidate portal|linkedin(?:-in)?|youtube|facebook(?:-f)?|instagram|twitter|x)$/i;

function blockedHost(hostname) {
  return BLOCKED_CAREERS_HOSTS.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`)
  );
}

function isBlockedCareersUrl(url) {
  try {
    const parsed = new URL(url);
    return (
      !["http:", "https:"].includes(parsed.protocol) ||
      blockedHost(parsed.hostname.toLowerCase()) ||
      STATIC_ASSET_RE.test(parsed.pathname)
    );
  } catch {
    return true;
  }
}

function isGenericCareersTitle(title, company) {
  const clean = title.replace(/\s+/g, " ").trim();
  if (!clean) return true;
  if (GENERIC_CAREERS_TITLE_RE.test(clean)) return true;
  const companyName = String(company.name || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (companyName) {
    const companyPageRe = new RegExp(`^(?:careers?|jobs?|openings?)\\s*(?:[|:—-]\\s*)?${companyName}$`, "i");
    if (companyPageRe.test(clean)) return true;
  }
  return false;
}

function looksLikeJobTitle(title) {
  return ROLE_TITLE_RE.test(title) && !isTalentPool(title);
}

function looksLikeJobUrl(url) {
  const parsed = new URL(url);
  return JOB_URL_MARKER_RE.test(`${parsed.hostname}${parsed.pathname}`);
}

async function parseCareersPage(company) {
  try {
    const targetUrl = company.source?.url || company.careersUrl || company.website;
    const html = await fetchText(targetUrl);
    const jobs = [];
    const seen = new Set();
    const re = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = re.exec(html))) {
      let url;
      try {
        url = new URL(m[1], targetUrl).href;
      } catch {
        continue;
      }
      const href = m[1];
      if (href.startsWith("#")) {
        if (!href.startsWith("#collapse-")) continue;
      } else {
        const parsed = new URL(href, targetUrl);
        if (!looksLikeJobUrl(parsed.href) && !/\/positions?\b|\/jobs?\b|\/careers?\b|\/openings?\b/i.test(parsed.pathname)) continue;
      }
      const title = stripHtml(m[2]).trim();
      const slug = title.toLowerCase().replace(/\W+/g, "-").replace(/^-+|-+$/g, "");
      if (!slug || seen.has(slug) || seen.has(url)) continue;
      if (isBlockedCareersUrl(url)) continue;
      if (isGenericCareersTitle(title, company) || !looksLikeJobTitle(title)) continue;
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

async function homerun(company) {
  const url = company.source?.url || "https://feed.homerun.co/proshore";
  const xml = await fetchText(url);
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].map((m) => m[1]);

  return entries
    .map((entry) => {
      const title = (entry.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "";
      const href = (entry.match(/<link[^>]*href="([^"]+)"/i) || [])[1] || "";
      const updated = (entry.match(/<updated>([\s\S]*?)<\/updated>/i) || [])[1] || null;
      const summary = (entry.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i) || entry.match(/<content[^>]*>([\s\S]*?)<\/content>/i) || [])[1] || "";
      const cleanTitle = stripHtml(title).trim();
      const cleanDescription = stripHtml(summary).trim();
      if (!cleanTitle || !href) return null;
      return normalize({
        id: `${company.id}-${cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
        companyId: company.id,
        company: company.name,
        title: cleanTitle,
        description: cleanDescription || `Open role at ${company.name}. Apply via the Proshore HomeRun job page.`,
        location: company.location,
        employmentType: "Full-time",
        postedAt: updated,
        applyUrl: href,
        careersUrl: company.careersUrl,
        applyEmail: company.applyEmail,
        applyHow: `Apply on the Proshore HomeRun job board: ${href}`,
        source: "HomeRun",
      });
    })
    .filter(Boolean)
    .filter((job) => nepalRelevant(job.location, job.summary, company.forceNepal));
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



/**
 * Devfinity careers page (WordPress).
 * Job titles live in <span class="career-title">, apply URLs in sibling <a> tags.
 */
async function devfinityJobs(company) {
  const targetUrl = company.source?.url || company.careersUrl;
  const html = await fetchText(targetUrl);
  const jobs = [];
  // Match each .career block: title span + optional link
  const blockRe = /<div[^>]+class="[^"]*career[^"]*"[^>]*>([\/\s\S]*?)<\/div>/gi;
  let block;
  const seen = new Set();
  while ((block = blockRe.exec(html))) {
    const chunk = block[1];
    // Extract all title + link pairs within this block
    const titleRe = /<span[^>]+class="[^"]*career-title[^"]*"[^>]*>([^<]+)<\/span>/gi;
    const linkRe = /href="(https?:\/\/devfinity\.com\/career\/[^"]+)"/gi;
    let tm;
    const titles = [];
    while ((tm = titleRe.exec(chunk))) titles.push(tm[1].trim());
    const links = [];
    let lm;
    while ((lm = linkRe.exec(chunk))) links.push(lm[1]);
    for (let i = 0; i < titles.length; i++) {
      const title = titles[i];
      const applyUrl = links[i] || targetUrl;
      const slug = title.toLowerCase().replace(/\W+/g, "-").replace(/^-+|-+$/g, "");
      if (!title || seen.has(slug)) continue;
      seen.add(slug);
      // Extract location from career-location address if present
      const locMatch = chunk.match(/<address[^>]+class="[^"]*career-location[^"]*"[^>]*>([^<]+)<\/address>/i);
      const rawLoc = locMatch ? locMatch[1].replace(/\(.*?\)/g, "").trim() : company.location;
      jobs.push(
        normalize({
          id: `${company.id}-${slug}`,
          companyId: company.id,
          company: company.name,
          title,
          location: cleanNepalLocation(rawLoc || company.location),
          applyUrl,
          careersUrl: company.careersUrl,
          applyEmail: company.applyEmail,
          applyHow: `Apply on the Devfinity careers portal: ${applyUrl}`,
          source: "Devfinity careers",
        })
      );
    }
  }
  return jobs.filter((j) => nepalRelevant(j.location, j.summary, company.forceNepal));
}

/**
 * Veel (veelapp.com) — Next.js SSR page with Lexical CMS content.
 * Job data is embedded in a Next.js RSC payload script block as double-encoded JSON.
 * Each job object ends with: department, employmentType, location, slug, title,
 * workArrangement, id — followed by description blocks with Lexical editor content.
 */
async function veelappJobs(company) {
  const targetUrl = company.source?.url || company.careersUrl;
  const html = await fetchText(targetUrl);

  // Find the script block containing job data — detect by RSC schema structure,
  // not job titles (structural keys are always present regardless of current listings)
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  const jobScript = scripts.find(s => /\"blockType\".*?\"aboutRole\".*?\"workArrangement\"/s.test(s) ||
    /\\\"blockType\\\".*?\\\"workArrangement\\\"/s.test(s));
  if (!jobScript) return [];

  // Unescape the RSC double-escaped JSON
  const unescaped = jobScript
    .replace(/\\\\"/g, "\x01")
    .replace(/\\"/g, '"')
    .replace(/\x01/g, '\\"')
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\\\/g, "\\");

  /** Recursively extract plain text from a Lexical node tree. */
  function lexicalText(node) {
    if (!node) return "";
    if (node.text !== undefined) return node.text;
    if (node.children) return node.children.map(lexicalText).join("");
    return "";
  }

  /** Convert Lexical node tree to HTML. */
  function lexicalToHtml(node) {
    if (!node) return "";
    const ch = (node.children || []).map(lexicalToHtml).join("");
    switch (node.type) {
      case "root":      return ch;
      case "paragraph": return ch ? `<p>${ch}</p>` : "";
      case "heading":   return `<h${node.tag || 3}>${ch}</h${node.tag || 3}>`;
      case "list":      return node.listType === "number" ? `<ol>${ch}</ol>` : `<ul>${ch}</ul>`;
      case "listitem":  return `<li>${ch}</li>`;
      case "text": {
        let t = node.text || "";
        if (node.format & 1) t = `<strong>${t}</strong>`;
        if (node.format & 2) t = `<em>${t}</em>`;
        return t;
      }
      default: return ch;
    }
  }

  // Each job object ends with: "department":"...", "employmentType":"...",
  // "location":"...", "slug":"...", "title":"...", "workArrangement":"...", "id":"uuid"
  const jobRe = /\{"createdAt":"[^"]+","updatedAt":"[^"]+","description":(\[[\s\S]*?\]),"generateSlug":(?:false|true),"_status":"published","department":"([^"]*)","employmentType":"([^"]*)","location":"([^"]*)","slug":"([^"]*)","title":"([^"]*)","workArrangement":"([^"]*)","id":"([^"]*)"\}/g;

  const jobs = [];
  const seen = new Set();
  let m;

  while ((m = jobRe.exec(unescaped))) {
    const [, descJson, department, employmentType, , , rawTitle, workArrangement, uuid] = m;
    const title = rawTitle.replace(/\\u0026/g, "&").trim();
    if (!title || seen.has(uuid)) continue;
    seen.add(uuid);

    // Parse Lexical description blocks → HTML + summary
    let descriptionHtml = "";
    let summary = "";
    try {
      const blocks = JSON.parse(descJson);
      for (const block of blocks) {
        const blockTitle = block.title || "";
        const root = block.content?.root;
        if (!root) continue;
        const blockHtml = lexicalToHtml(root);
        if (blockTitle) {
          descriptionHtml += `<h3>${blockTitle}</h3>${blockHtml}`;
        } else {
          descriptionHtml += blockHtml;
        }
        // Use "Role Overview" block as summary; fall back to "About Veel"
        if (!summary && block.blockType === "aboutRole" && /role overview/i.test(blockTitle)) {
          summary = lexicalText(root).trim().slice(0, 450);
        }
      }
      if (!summary) {
        // Fall back to first non-empty block text
        const blocks2 = JSON.parse(descJson);
        for (const block of blocks2) {
          const t = lexicalText(block.content?.root || {}).trim();
          if (t) { summary = t.slice(0, 450); break; }
        }
      }
    } catch (e) {
      log(`[veelapp] desc parse error for "${title}": ${e.message}`);
    }

    // Map workArrangement field to our workType values
    const workTypeMap = { "on-site": "On-site", "remote": "Remote", "hybrid": "Hybrid", "hybrid / on-site": "Hybrid" };
    const workType = workTypeMap[workArrangement.toLowerCase()] || workArrangement;

    jobs.push(
      normalize({
        id: `${company.id}-${uuid}`,
        companyId: company.id,
        company: company.name,
        title,
        department,
        location: company.location,
        workType,
        employmentType,
        applyUrl: targetUrl,
        careersUrl: company.careersUrl,
        applyEmail: company.applyEmail,
        applyHow: `Visit the Veel careers page to read the full job description and apply: ${targetUrl}`,
        summary,
        descriptionHtml,
        source: "Veel careers",
      })
    );
  }
  return jobs.filter((j) => nepalRelevant(j.location, j.summary, company.forceNepal));
}

/**
 * Fusemachines (fusemachines.com) — JazzHR custom API endpoint
 */
async function fusemachinesJobs(company) {
  const apiUrl =
    company.source?.url ||
    company.source?.apiUrl ||
    "https://api-website-v1.fusemachines.com/api/v1/careers?status=open&send_to_job_boards=Yes";
  const data = await fetchText(apiUrl, { json: true });

  const jobs = [];
  for (const item of Array.isArray(data) ? data : []) {
    const title = (item.title || "").trim();
    if (!title) continue;

    const country = item.country_id || "";
    const city = item.city || "";
    const rawLoc = [city, country].filter(Boolean).join(", ");
    const location = cleanNepalLocation(rawLoc || company.location);

    const applyUrl = item.board_code
      ? `https://jobs.fusemachines.com/apply/${item.board_code}`
      : company.careersUrl;

    const descriptionHtml = item.description || "";

    jobs.push(
      normalize({
        id: `${company.id}-${item.board_code || item.id}`,
        companyId: company.id,
        company: company.name,
        title,
        department: item.department || "",
        location,
        employmentType: item.type || "Full-time",
        postedAt: item.original_open_date || null,
        applyUrl,
        careersUrl: company.careersUrl,
        applyEmail: company.applyEmail,
        applyHow: `Apply online via Fusemachines career portal: ${applyUrl}`,
        descriptionHtml,
        source: "Fusemachines careers",
      })
    );
  }

  return jobs.filter((j) => nepalRelevant(j.location, j.summary, company.forceNepal));
}

async function oracleHcm(company) {
  const url = company.source?.apiUrl || `https://fa-ewmy-saasfaprod1.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList&finder=findReqs;siteNumber=${company.source?.siteNumber || "CX_1"},limit=155`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const data = await res.json();
  const searchObj = data.items?.[0] || {};
  const list = searchObj.requisitionList || [];

  return list
    .filter((req) => {
      if (req.PrimaryLocationCountry === "NP") return true;
      const locStr = req.PrimaryLocation || "";
      return nepalRelevant(locStr, req.Title || "", false);
    })
    .map((req) => {
      const locStr = cleanNepalLocation(req.PrimaryLocation || "Kathmandu, Nepal");
      const jobUrl = `https://fa-ewmy-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/${company.source?.siteNumber || "CX_1"}/job/${req.Id}`;
      return normalize({
        id: `${company.id}-${req.Id}`,
        companyId: company.id,
        company: company.name,
        title: req.Title,
        department: req.JobFamily || "",
        description: req.ShortDescriptionStr || "",
        location: locStr,
        employmentType: req.JobSchedule || "Full-time",
        postedAt: req.PostedDate || null,
        applyUrl: jobUrl,
        careersUrl: company.careersUrl,
        applyHow: `Apply on Verisk official Oracle Cloud career portal: ${jobUrl}`,
        source: "Verisk Career Portal (Oracle Cloud)",
      });
    });
}

async function iqvia(company) {
  const html = await fetchText(company.source.url);
  const payload = html.replace(/\\"/g, '"');
  const records = payload.match(/"instance_id"\s*:\s*"[\s\S]*?(?="instance_id"\s*:|$)/g) || [];
  const field = (record, name) => {
    const match = record.match(new RegExp(`"${name}"\\s*:\\s*"([^"]*)"`));
    return match ? match[1] : "";
  };

  return records
    .map((record) => ({
      title: field(record, "job_title"),
      reqId: field(record, "job_req_id"),
      city: field(record, "city"),
      country: field(record, "country"),
      organization: field(record, "name"),
      department: field(record, "employment_unit"),
      employmentType: field(record, "employment_type"),
      postedAt: field(record, "date_posted"),
    }))
    .filter(
      (job) =>
        job.reqId &&
        job.title &&
        job.country === "Nepal" &&
        job.organization.toLowerCase() === company.name.toLowerCase()
    )
    .map((job) => {
      const slug = job.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const jobUrl = `https://jobs.iqvia.com/en/job/${job.reqId}/${slug}`;
      return normalize({
        id: `${company.id}-${job.reqId}`,
        companyId: company.id,
        company: company.name,
        title: job.title,
        department: job.department,
        location: job.city,
        employmentType: job.employmentType,
        postedAt: job.postedAt,
        applyUrl: jobUrl,
        careersUrl: company.careersUrl,
        applyEmail: company.applyEmail,
        applyHow: `Apply on the IQVIA careers portal: ${jobUrl}`,
        source: "IQVIA Career Portal",
      });
    });
}

async function zohoRecruit(company) {
  const html = await fetchText(company.source.url);
  const match = html.match(/<input[^>]*value="([^"]*)"[^>]*id="jobs"/i);
  if (!match) return [];

  const jobs = JSON.parse(
    match[1]
      .replace(/&#34;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
  );

  return jobs
    .filter((job) => job.Publish && job.Country === "Nepal")
    .map((job) => {
      const title = job.Posting_Title || job.Job_Opening_Name;
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const jobUrl = `${new URL(company.source.url).origin}/jobs/Careers/${job.id}`;
      return normalize({
        id: `${company.id}-${job.id}`,
        companyId: company.id,
        company: company.name,
        title,
        department: job.Industry || "",
        location: job.City || company.location,
        employmentType: job.Job_Type || "Full-time",
        applyUrl: jobUrl,
        careersUrl: company.careersUrl,
        applyEmail: company.applyEmail,
        applyHow: `Apply on the Techkraft careers portal: ${jobUrl}`,
        source: "Zoho Recruit",
      });
    });
}

async function linkedinJobs(company) {
  try {
    const query = company.source?.keyword || company.name;
    const filter = (company.source?.filter || company.name).toLowerCase();
    const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(query)}&location=Nepal&start=0`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) {
      console.warn(`LinkedIn fetch returned ${res.status} for ${company.name}`);
      return [];
    }
    const html = await res.text();
    const cardRegex = /<div[^>]+class="[^"]*base-search-card[^"]*"[\s\S]*?<\/li>/gi;
    const cards = html.match(cardRegex) || [];
    const jobs = [];
    const seen = new Set();

    for (const card of cards) {
      const title = (card.match(/<h3 class="base-search-card__title">([\s\S]*?)<\/h3>/i)?.[1] || "").trim();
      const comp = (card.match(/<h4 class="base-search-card__subtitle">([\s\S]*?)<\/h4>/i)?.[1] || "").replace(/<[^>]+>/g, "").trim();
      const link = card.match(/<a class="base-card__full-link[^"]*"\s+href="([^"?]+)/i)?.[1] || "";
      const rawLoc = (card.match(/<span class="job-search-card__location">([\s\S]*?)<\/span>/i)?.[1] || "").trim();
      if (!nepalRelevant(rawLoc, title, false)) continue;
      const loc = cleanNepalLocation(rawLoc);
      const date = card.match(/<time[^>]+datetime="([^"]+)"/i)?.[1] || null;

      if (!title || !link || !comp) continue;
      const compLower = comp.toLowerCase();
      if (!compLower.includes(filter) && !filter.includes(compLower)) continue;

      const slug = title.toLowerCase().replace(/\W+/g, "-").replace(/^-+|-+$/g, "");
      if (seen.has(slug) || seen.has(link)) continue;
      seen.add(slug);
      seen.add(link);

      jobs.push(
        normalize({
          id: `${company.id}-${slug}`,
          companyId: company.id,
          company: company.name,
          title,
          description: `${title} at ${company.name} (${loc || company.location}). View and apply directly on LinkedIn.`,
          location: loc || company.location,
          postedAt: date,
          applyUrl: link,
          careersUrl: company.careersUrl,
          applyEmail: company.applyEmail,
          applyHow: `Apply on LinkedIn: ${link}`,
          source: "LinkedIn",
        })
      );
    }
    // Rate limit delay (1s) to be gentle on guest endpoint
    await new Promise((r) => setTimeout(r, 1000));
    return jobs;
  } catch (err) {
    console.error(`LinkedIn error for ${company.name}: ${err.message}`);
    return [];
  }
}

const fetchers = {
  linkedin: (c) => linkedinJobs(c),
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
  "oracle-hcm": (c) => oracleHcm(c),
  iqvia: (c) => iqvia(c),
  "zoho-recruit": (c) => zohoRecruit(c),
  homerun: (c) => homerun(c),
  yarsalabs: (c) => yarsalabs(c),
  devfinity: (c) => devfinityJobs(c),
  veelapp: (c) => veelappJobs(c),
  fusemachines: (c) => fusemachinesJobs(c),
};

const targetCompanyArg =
  process.argv.find((a) => a.startsWith("--company="))?.split("=")[1] ||
  (process.argv.includes("--company")
    ? process.argv[process.argv.indexOf("--company") + 1]
    : null);

const companiesToRun = targetCompanyArg
  ? companies.filter(
      (c) =>
        c.id.toLowerCase() === targetCompanyArg.toLowerCase() ||
        c.name.toLowerCase().includes(targetCompanyArg.toLowerCase())
    )
  : companies;

if (targetCompanyArg && companiesToRun.length === 0) {
  console.error(`No company found matching "${targetCompanyArg}"`);
  process.exit(1);
}

const results = [];
const errors = [];

for (const company of companiesToRun) {
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

let finalJobs = results;

if (targetCompanyArg) {
  // Merge scraped jobs with existing jobs in data/jobs.json
  const targetIds = new Set(companiesToRun.map((c) => c.id));
  try {
    const existingData = JSON.parse(await readFile(join(ROOT, "data", "jobs.json"), "utf8"));
    const existingJobs = (existingData.jobs || []).filter((j) => !targetIds.has(j.companyId));
    finalJobs = [...existingJobs, ...results];
  } catch (e) {
    console.log("Could not load existing data/jobs.json, writing target company jobs only.");
  }
}

finalJobs.sort((a, b) => String(b.postedAt || "").localeCompare(String(a.postedAt || "")));

const payload = {
  generatedAt: new Date().toISOString(),
  jobCount: finalJobs.length,
  companyCount: companies.length,
  errors,
  jobs: finalJobs,
};

// Detect any company IDs/names produced by scraping that aren't present in data/companies.json
const existingIds = new Set(companies.map((c) => c.id));
const existingNames = new Map(companies.map((c) => [String(c.name || "").toLowerCase(), c.id]));
const newCompanies = [];
for (const job of results) {
  const jid = String(job.companyId || "").trim();
  const jname = String(job.company || "").trim();
  if (!jname) continue;
  // If companyId already matches an existing id, skip
  if (existingIds.has(jid)) continue;
  // If the job's companyId looks like a slug created from a detected name, and the name isn't present, create a company entry
  if (!existingIds.has(jid)) {
    // Avoid adding duplicates for the same name
    if (newCompanies.some((c) => String(c.name || "").toLowerCase() === jname.toLowerCase())) {
      // update job.companyId to the id we generated earlier
      const existing = newCompanies.find((c) => String(c.name || "").toLowerCase() === jname.toLowerCase());
      if (existing) job.companyId = existing.id;
      continue;
    }

    const newId = jid || slugify(jname);
    let website = job.careersUrl || "";
    try {
      if (website) website = new URL(website).origin;
    } catch {
      website = null;
    }

    const companyObj = {
      id: newId,
      name: jname,
      website,
      logoUrl: null,
      careersUrl: job.careersUrl || website,
      applyEmail: null,
      location: job.location || "Nepal",
      hq: job.location || "",
      size: null,
      employeeRange: null,
      founded: null,
      industry: "",
      type: "",
      about: "",
      techStack: [],
      clientTypes: [],
      coordinates: null,
      forceNepal: true,
      source: { kind: "scraped-child" },
      linkedinUrl: null,
    };

    newCompanies.push(companyObj);
    existingIds.add(newId);
    existingNames.set(jname.toLowerCase(), newId);
    job.companyId = newId;
  }
}

if (newCompanies.length) {
  companies.push(...newCompanies);
  await writeFile(join(ROOT, "data", "companies.json"), JSON.stringify(companies, null, 2));
  console.log(`Appended ${newCompanies.length} new child companies to data/companies.json`);
  payload.companyCount = companies.length;
}

await mkdir(join(ROOT, "data"), { recursive: true });
await writeFile(join(ROOT, "data", "jobs.json"), JSON.stringify(payload, null, 2));
console.log(`Wrote ${finalJobs.length} jobs (scraped ${results.length} jobs for ${companiesToRun.length} company)`);
