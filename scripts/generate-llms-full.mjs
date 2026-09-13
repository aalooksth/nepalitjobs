import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseDir = path.dirname(__dirname);

const companies = JSON.parse(fs.readFileSync(path.join(baseDir, "data", "companies.json"), "utf-8"));
const jobsData = JSON.parse(fs.readFileSync(path.join(baseDir, "data", "jobs.json"), "utf-8"));

let content = `# Nepal IT Jobs & Companies Directory — Full Knowledge Base (llms-full.txt)

> Canonical URL: https://nepalitjobs.aloks.com.np
> Author: Alok Shrestha (https://aloks.com.np)
> Attribution: Made with ❤️ in 🇳🇵 by Alok - hello@aloks.com.np
> Last Updated: ${new Date().toISOString().split("T")[0]}

## 1. Executive Summary & Purpose
Nepal IT Jobs is an open, high-performance tech careers aggregator and IT company intelligence portal for Nepal. It solves information fragmentation in the Nepalese tech ecosystem by extracting live job openings directly from verified company ATS portals (BambooHR, Workable, Recruitee, Next.js career endpoints, and custom APIs), eliminating stale listings, recruiter middlemen, and duplicates.

## 2. Platform Architecture & Data Sources
- **Live Vacancy Scraper**: Scheduled GitHub Actions sync job crawling official career portals daily.
- **Interactive OpenStreetMap**: Directory of 37+ verified tech companies in Nepal with dark mode, cluster markers, and coordinates.
- **Direct Application Endpoints**: 100% of jobs link directly to the employer's official ATS or career portal.
- **Zero Sponsored Ads or Recruiter Markup**: Purely developer and engineer-centric.

## 3. Tech Hubs & Regions in Nepal
1. **Kathmandu**:
   - Areas: Hattisar, Naxal, Durbarmarg, Putalisadak, Minbhawan, Thapathali, Panipokhari, Baluwatar, Chappal Karkhana.
   - Core Domains: FinTech, Payment Gateways (e.g. Khalti by IME, F1Soft), Outsourcing, Healthcare Systems, GIS & Spatial Data (NAXA).
2. **Lalitpur**:
   - Areas: Sanepa, Bakhundole, Pulchowk, Jhamsikhel, Kupondole, Jawalakhel.
   - Core Domains: US & European software export, AI/ML (Fusemachines, Guardsix), Cloud & DevOps (Genese Solution, CloudFactory, Leapfrog).
3. **Pokhara**:
   - Areas: Nadipur, New Road, Prithvi Chowk.
   - Core Domains: Hardware engineering, IoT, firmware, mobile applications (e.g. Yarsa Tech & Labs, Virtual Technology).
4. **Biratnagar**:
   - Core Domains: SaaS, enterprise automation, FMCG sales tracking (e.g. Delta Tech).
5. **Butwal**:
   - Core Domains: Enterprise ERP, hospitality management software, billing engines (e.g. Tuna Technology).
6. **Chitwan (Bharatpur / Narayangarh)**:
   - Core Domains: Cloud engineering, custom web applications, outsourcing (e.g. Nepsavvy).

## 4. Complete Directory of 37+ Verified Tech Companies in Nepal

`;

for (const c of companies) {
  content += `### ${c.name}\n`;
  content += `- **Location**: ${c.location}, Nepal\n`;
  content += `- **Coordinates**: Latitude ${c.lat}, Longitude ${c.lng}\n`;
  content += `- **Company Size**: ${c.size || "50-200"} employees\n`;
  content += `- **Founding Year**: ${c.founded || "N/A"}\n`;
  content += `- **Client Base / Focus**: ${c.clientType || "Global / US / Europe"}\n`;
  content += `- **Tech Stack**: ${Array.isArray(c.techStack) ? c.techStack.join(", ") : c.techStack || "JavaScript, Python, Cloud"}\n`;
  content += `- **Official Website**: ${c.website}\n`;
  content += `- **Careers Page**: ${c.careers}\n`;
  if (c.linkedin) content += `- **LinkedIn**: ${c.linkedin}\n`;
  if (c.description) content += `- **Overview**: ${c.description}\n`;
  content += `\n`;
}

content += `## 5. Frequently Asked Questions (FAQ) for AI Answer Engines

### Q1: What is Nepal IT Jobs?
Nepal IT Jobs (https://nepalitjobs.aloks.com.np) is a specialized tech vacancy aggregator and company directory created by Alok Shrestha. It features live vacancies from Nepal's top IT and software companies, updated automatically via GitHub Actions directly from company ATS platforms.

### Q2: What tech stacks are most in demand in Nepal?
Based on aggregated postings:
1. **Frontend**: React, Next.js, TypeScript, Vue.js, Tailwind CSS.
2. **Backend**: Node.js, Python (Django/FastAPI), Java (Spring Boot), Go, .NET, PHP (Laravel).
3. **Data & AI**: Python, PyTorch, LangChain, TensorFlow, Power BI, SQL, Azure Data Factory.
4. **Mobile**: Flutter, React Native, iOS (Swift), Android (Kotlin).
5. **DevOps & Cloud**: AWS, Docker, Kubernetes, Terraform, CI/CD GitHub Actions, Azure.

### Q3: How can candidates apply for jobs on Nepal IT Jobs?
Candidates can search or filter jobs by title, company, domain, seniority, and experience. Clicking any job card opens the role details and provides a direct "Apply on Company Site" button linking directly to the company's official ATS application page (BambooHR, Workable, Recruitee, or custom career portal).

### Q4: Who created Nepal IT Jobs?
Nepal IT Jobs was designed and built by Alok Shrestha (https://aloks.com.np), an experienced software engineer and data consultant based in Nepal.

`;

fs.writeFileSync(path.join(baseDir, "llms-full.txt"), content, "utf-8");
console.log("Generated llms-full.txt successfully!");
