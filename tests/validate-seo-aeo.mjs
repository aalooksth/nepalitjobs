import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.dirname(__dirname);

let passed = 0;
let failed = 0;

function check(desc, condition) {
  if (condition) {
    console.log(`  ✅ ${desc}`);
    passed++;
  } else {
    console.error(`  ❌ ${desc}`);
    failed++;
  }
}

console.log("\n🚀 Validating SEO, AEO & Assets Configuration…");

// 1. Check Favicon & OG Image
check("favicon.ico exists", fs.existsSync(path.join(root, "favicon.ico")));
check("favicon.svg exists", fs.existsSync(path.join(root, "favicon.svg")));
check("og-image.png exists and is > 10KB", fs.existsSync(path.join(root, "og-image.png")) && fs.statSync(path.join(root, "og-image.png")).size > 10240);

// 2. Check LLM Knowledge Files
check("llms.txt exists", fs.existsSync(path.join(root, "llms.txt")));
const llmsTxt = fs.readFileSync(path.join(root, "llms.txt"), "utf-8");
check("llms.txt has canonical URL", llmsTxt.includes("https://nepalitjobs.aloks.com.np"));
check("llms.txt references llms-full.txt", llmsTxt.includes("llms-full.txt"));
check("llms.txt references sitemap.xml", llmsTxt.includes("sitemap.xml"));

check("llms-full.txt exists", fs.existsSync(path.join(root, "llms-full.txt")));
const llmsFullTxt = fs.readFileSync(path.join(root, "llms-full.txt"), "utf-8");
check("llms-full.txt has verified companies", llmsFullTxt.includes("Leapfrog Technology") && llmsFullTxt.includes("F1Soft Group"));
check("llms-full.txt has Q&A section", llmsFullTxt.includes("Frequently Asked Questions"));

// 3. Check robots.txt & sitemap.xml
const robotsTxt = fs.readFileSync(path.join(root, "robots.txt"), "utf-8");
check("robots.txt allows GPTBot", robotsTxt.includes("User-agent: GPTBot"));
check("robots.txt allows PerplexityBot", robotsTxt.includes("User-agent: PerplexityBot"));
check("robots.txt allows ClaudeBot", robotsTxt.includes("User-agent: ClaudeBot"));
check("robots.txt declares Sitemap", robotsTxt.includes("Sitemap: https://nepalitjobs.aloks.com.np/sitemap.xml"));

const sitemapXml = fs.readFileSync(path.join(root, "sitemap.xml"), "utf-8");
check("sitemap.xml has homepage", sitemapXml.includes("<loc>https://nepalitjobs.aloks.com.np/</loc>"));
check("sitemap.xml has companies page", sitemapXml.includes("<loc>https://nepalitjobs.aloks.com.np/companies.html</loc>"));
check("sitemap.xml has image extension", sitemapXml.includes("xmlns:image=") && sitemapXml.includes("og-image.png"));

// 4. Check index.html SEO & AEO elements
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf-8");
check("index.html has og:image", indexHtml.includes("property=\"og:image\""));
check("index.html has twitter:card summary_large_image", indexHtml.includes("name=\"twitter:card\" content=\"summary_large_image\""));
check("index.html has favicon.ico link", indexHtml.includes("href=\"favicon.ico\""));
check("index.html has WebSite schema", indexHtml.includes("\"@type\": \"WebSite\""));
check("index.html has FAQPage schema", indexHtml.includes("\"@type\": \"FAQPage\""));
check("index.html has BreadcrumbList schema", indexHtml.includes("\"@type\": \"BreadcrumbList\""));
check("index.html has semantic FAQ accordion", indexHtml.includes("class=\"faq-accordion-item\""));
check("index.html has Network dropdown", indexHtml.includes("class=\"network-dropdown-wrap\""));
check("index.html has Light/System/Dark theme controls", indexHtml.includes("data-theme-val=\"system\""));

// 5. Check companies.html SEO & AEO elements
const companiesHtml = fs.readFileSync(path.join(root, "companies.html"), "utf-8");
check("companies.html has og:image", companiesHtml.includes("property=\"og:image\""));
check("companies.html has twitter:card", companiesHtml.includes("name=\"twitter:card\""));
check("companies.html has BreadcrumbList schema", companiesHtml.includes("\"@type\": \"BreadcrumbList\""));
check("companies.html has crawlable guide section", companiesHtml.includes("class=\"container seo-guide-section\""));
check("companies.html has Network dropdown", companiesHtml.includes("class=\"network-dropdown-wrap\""));

// 6. Check Attribution
check("index.html has Alok attribution", indexHtml.includes("Made with ❤️ in 🇳🇵 by") && indexHtml.includes("hello@aloks.com.np"));
check("companies.html has Alok attribution", companiesHtml.includes("Made with ❤️ in 🇳🇵 by") && companiesHtml.includes("hello@aloks.com.np"));

console.log("\n────────────────────────────────────────────────");
console.log(`  Passed: ${passed} | Failed: ${failed}`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log("✅ All SEO, AEO & Integration checks passed successfully!\n");
}
