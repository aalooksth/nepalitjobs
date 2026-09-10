# Nepal IT Jobs & Companies Directory

[![Live Website](https://img.shields.io/badge/Live%20Site-nepalitjobs.aloks.com.np-7c3aed?style=flat-square&logo=google-chrome&logoColor=white)](https://nepalitjobs.aloks.com.np)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live%20Deploy-success?style=flat-square&logo=github)](https://nepalitjobs.aloks.com.np)
[![Made in Nepal](https://img.shields.io/badge/Made%20with%20%E2%9D%A4%EF%B8%8F%20in-Nepal%20%F0%9F%87%B3%F0%9F%87%B5-dc2626?style=flat-square)](https://aloks.com.np)

A high-performance, live-aggregated tech job portal and interactive IT company directory for Nepal. Designed for developers, engineers, and tech professionals to discover vacancies and explore tech companies across the Kathmandu Valley and regional tech hubs (Pokhara, Biratnagar, Butwal, and Chitwan).

Hosted on GitHub Pages at [https://nepalitjobs.aloks.com.np](https://nepalitjobs.aloks.com.np).

---

## ✨ Features

- **Live Vacancies**: Aggregated automatically from company career boards, BambooHR, Recruitee, Workable, and Next.js career endpoints.
- **Interactive OpenStreetMap**: Keyless, high-resolution Leaflet map rendering customized company logo badges with dark mode support.
- **Rich Company Profiles**: Explore 37+ verified IT companies with tech stacks, industries, client domains, employee sizes, and headquarters.
- **Company Comparison**: Side-by-side comparison modal evaluating tech stacks, company size, founded years, and active roles.
- **Multi-Factor Filtering**: Filter by location (Kathmandu, Pokhara, Biratnagar, Butwal, Chitwan), company type (Product vs. Services), seniority, domain, and tech keywords.
- **Quick Links Toolbar**: Direct, verified one-click buttons for Website, Careers portal, and LinkedIn.
- **Dark / Light / System Theme**: Instant theme switching with preference persistence.

---

## 🚀 Quick Start

### Running Locally
1. Clone the repository:
   ```bash
   git clone git@github.com:aalooksth/nepalitjobs.git
   cd nepalitjobs
   ```
2. Serve static assets locally:
   ```bash
   npx serve . -p 3000
   ```
3. Open `http://localhost:3000` in your browser.

### Syncing Live Vacancies
Run the automated multi-source job fetcher:
```bash
npm run sync
```

### Running Automated Tests
```bash
npm test
```

---

## 🗺️ Tech Stack

- **Frontend**: Vanilla HTML5, CSS3 with modern CSS custom properties (variables, glassmorphism, responsive grid).
- **Interactive Maps**: Leaflet.js with keyless OpenStreetMap tile layers.
- **Automation**: Node.js automated ingestion pipelines (`scripts/sync-jobs.mjs`).
- **Hosting**: GitHub Pages with custom domain `nepalitjobs.aloks.com.np`.

---

## 📜 Version History & Changelog

### v1.0.0
- **Initial Production Release**:
  - Live job board with multi-source career scraping.
  - Interactive Leaflet map featuring company logo pins.
  - Directory of 37 verified IT companies across Nepal.
  - Side-by-side company comparison tool.
  - Custom domain deployment on `nepalitjobs.aloks.com.np`.

---

## 👤 Author & Attribution

**Alok Shrestha**
- Website: [aloks.com.np](https://aloks.com.np)
- Email: [hello@aloks.com.np](mailto:hello@aloks.com.np)

*Made with ❤️ in 🇳🇵 by Alok - hello@aloks.com.np*
