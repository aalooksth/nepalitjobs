/**
 * app.js — Nepal IT Jobs frontend
 * Loads data/jobs.json + data/companies.json, renders cards,
 * handles filtering, sorting, search, modal, theme toggle.
 *
 * Made with ❤️ in 🇳🇵 by Alok — hello@aloks.com.np
 */

"use strict";

/* ══════════════════════════════════════════
   CONSTANTS & STATE
══════════════════════════════════════════ */
const PAGE_SIZE = 24;

const state = {
  jobs: [],
  companies: [],
  filtered: [],
  page: 1,
  view: "cards", // "cards" | "list"
  filters: {
    search: "",
    domains: new Set(),
    companies: new Set(),
    seniorities: new Set(),
    workTypes: new Set(),
    empTypes: new Set(),
    expBuckets: new Set(),
    tech: new Set(),
  },
  sort: "newest",
  activeCompanyFilter: null,
};

/* Domain → CSS class */
const DOMAIN_CLASS = {
  "AI / Machine Learning": "domain-ai",
  "Data":                  "domain-data",
  "DevOps / Platform":     "domain-devops",
  "Security":              "domain-security",
  "QA / Testing":          "domain-qa",
  "Mobile":                "domain-mobile",
  "Frontend":              "domain-frontend",
  "Backend":               "domain-backend",
  "Full Stack":            "domain-fullstack",
  "Design":                "domain-design",
};

function domainClass(d) { return DOMAIN_CLASS[d] || "domain-default"; }

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  initTheme();
  initDropdowns();
  loadData();
  setupSearch();
  setupSortListener();
  setupViewToggle();
  setupModalClose();
  setupMobileFilter();
  setupFilterAccordions();

  // Keyboard shortcut Cmd/Ctrl+K → focus search
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      document.getElementById("search-input").focus();
    }
    if (e.key === "Escape") {
      closeModal();
      closeAllDropdowns();
    }
  });

  // Re-apply hash filter on browser back/forward navigation
  window.addEventListener("hashchange", () => applyHashFilter());
});

/* ══════════════════════════════════════════
   THEME & DROPDOWNS
══════════════════════════════════════════ */
function applyTheme(mode) {
  const isSystemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = mode === "system" ? (isSystemDark ? "dark" : "light") : mode;
  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.setAttribute("data-theme-mode", mode);
  localStorage.setItem("nij-theme-mode", mode);

  // Update active option
  document.querySelectorAll(".theme-opt").forEach(opt => {
    opt.classList.toggle("active", opt.getAttribute("data-theme-val") === mode);
  });
}

function initTheme() {
  const savedMode = localStorage.getItem("nij-theme-mode") || localStorage.getItem("nij-theme") || "system";
  applyTheme(savedMode);

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    if ((localStorage.getItem("nij-theme-mode") || "system") === "system") {
      document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light");
    }
  });

  const themeBtn = document.getElementById("theme-toggle");
  const themeMenu = document.getElementById("theme-menu");

  if (themeBtn && themeMenu) {
    themeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isExpanded = themeBtn.getAttribute("aria-expanded") === "true";
      closeAllDropdowns();
      if (!isExpanded) {
        themeMenu.classList.add("show");
        themeBtn.setAttribute("aria-expanded", "true");
      }
    });

    themeMenu.querySelectorAll(".theme-opt").forEach(opt => {
      opt.addEventListener("click", (e) => {
        e.stopPropagation();
        const mode = opt.getAttribute("data-theme-val");
        applyTheme(mode);
        themeMenu.classList.remove("show");
        themeBtn.setAttribute("aria-expanded", "false");
      });
    });
  }
}

function initDropdowns() {
  const netBtn = document.getElementById("network-btn");
  const netMenu = document.getElementById("network-menu");

  if (netBtn && netMenu) {
    netBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isExpanded = netBtn.getAttribute("aria-expanded") === "true";
      closeAllDropdowns();
      if (!isExpanded) {
        netMenu.classList.add("show");
        netBtn.setAttribute("aria-expanded", "true");
      }
    });
  }

  document.addEventListener("click", () => {
    closeAllDropdowns();
  });
}

function closeAllDropdowns() {
  document.querySelectorAll(".network-dropdown-menu, .theme-dropdown-menu").forEach(m => m.classList.remove("show"));
  document.querySelectorAll(".network-btn, .theme-toggle-btn").forEach(b => b.setAttribute("aria-expanded", "false"));
}

/* ══════════════════════════════════════════
   DATA LOADING
══════════════════════════════════════════ */
async function loadData() {
  showLoading(true);
  try {
    const [jobsRes, companiesRes] = await Promise.all([
      fetch("data/jobs.json"),
      fetch("data/companies.json"),
    ]);
    if (!jobsRes.ok) throw new Error(`Jobs fetch failed: ${jobsRes.status}`);
    if (!companiesRes.ok) throw new Error(`Companies fetch failed: ${companiesRes.status}`);

    const jobsPayload = await jobsRes.json();
    state.jobs      = (jobsPayload.jobs || []).filter(j => j.listingKind !== "talent-pool");
    state.companies = await companiesRes.json();

    updateHeroStats(jobsPayload);
    buildFilterOptions();
    applyFilters();
    renderCompanies();
    injectJobPostingSchema(state.jobs, state.companies);
    showLoading(false);
    applyHashFilter();  // honour ?#company=id deep-links from companies directory
  } catch (err) {
    console.error("Data load error:", err);
    showError(err.message);
  }
}

/**
 * Reads #company=<id> from the URL hash and activates the matching company filter.
 * Called after data loads, and on every hashchange event.
 */
function applyHashFilter() {
  const raw = location.hash.slice(1);  // strip leading #
  if (!raw) return;
  const params = new URLSearchParams(raw);
  const companyId = params.get("company");
  if (!companyId) return;

  const company = state.companies.find(c => c.id === companyId);
  if (!company) return;

  // Activate company filter
  state.activeCompanyFilter = companyId;
  state.filters.companies.clear();
  state.filters.companies.add(company.name);

  // Highlight the matching card
  document.querySelectorAll(".company-card").forEach(c => {
    c.classList.toggle("active", c.dataset.id === companyId);
  });

  // Sync any visible checkbox
  document.querySelectorAll(`input[name="company"]`).forEach(cb => {
    cb.checked = cb.value === company.name;
  });

  state.page = 1;
  applyFilters();
  renderActivePills();

  // Scroll jobs section into view smoothly
  const jobsSection = document.getElementById("jobs-section");
  if (jobsSection) jobsSection.scrollIntoView({ behavior: "smooth" });
}

function injectJobPostingSchema(jobs, companies) {
  try {
    const existing = document.getElementById("job-posting-schema");
    if (existing) existing.remove();

    const compMap = new Map((companies || []).map(c => [c.id, c]));
    const topJobs = (jobs || []).slice(0, 30);

    const schemaItems = topJobs.map((j, idx) => {
      const comp = compMap.get(j.companyId) || { name: j.company || "Tech Employer in Nepal" };
      return {
        "@type": "JobPosting",
        "@id": `https://nepalitjobs.aloks.com.np/#job-${j.id || idx}`,
        "title": j.title,
        "description": j.description || `${j.title} opening at ${comp.name} in Nepal. Tech stack: ${(j.skills || []).join(", ")}.`,
        "datePosted": j.postedDate || "2026-09-10",
        "employmentType": (j.workType || "FULL_TIME").toUpperCase().replace("-", "_"),
        "hiringOrganization": {
          "@type": "Organization",
          "name": comp.name,
          "sameAs": comp.website || undefined
        },
        "jobLocation": {
          "@type": "Place",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": comp.location || "Kathmandu",
            "addressCountry": "NP"
          }
        },
        "applicantLocationRequirements": {
          "@type": "Country",
          "name": "Nepal"
        },
        "directApply": true,
        "url": j.applyUrl
      };
    });

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "job-posting-schema";
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": schemaItems
    });
    document.head.appendChild(script);
  } catch (err) {
    console.warn("Could not inject JobPosting schema:", err);
  }
}

function showLoading(yes) {
  document.getElementById("loading-state").style.display = yes ? "grid" : "none";
  document.getElementById("jobs-grid").style.display      = yes ? "none" : "grid";
  document.getElementById("error-state").classList.add("hidden");
  document.getElementById("empty-state").classList.add("hidden");
}

function showError(msg) {
  document.getElementById("loading-state").style.display = "none";
  document.getElementById("jobs-grid").style.display      = "none";
  document.getElementById("error-state").classList.remove("hidden");
  document.getElementById("error-msg").textContent = msg || "Please try refreshing.";
  document.getElementById("retry-btn").onclick = () => loadData();
}

/* ══════════════════════════════════════════
   HERO STATS
══════════════════════════════════════════ */
function updateHeroStats(payload) {
  const ago = payload.generatedAt
    ? timeAgo(new Date(payload.generatedAt))
    : "Unknown";

  document.getElementById("stat-jobs").textContent      = payload.jobCount ?? state.jobs.length;
  document.getElementById("stat-companies").textContent = payload.companyCount ?? state.companies.length;
  document.getElementById("stat-synced").textContent    = ago;
  document.getElementById("job-count").textContent      = payload.jobCount ?? state.jobs.length;
}

function timeAgo(date) {
  const diff = Date.now() - date;
  const m = Math.floor(diff / 60000);
  if (m < 1)   return "just now";
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/* ══════════════════════════════════════════
   FILTER OPTION BUILDERS
══════════════════════════════════════════ */
function buildFilterOptions() {
  const count = (arr, key) => arr.reduce((m, j) => {
    const v = j[key] || "Unknown";
    m[v] = (m[v] || 0) + 1; return m;
  }, {});

  buildCheckboxGroup("filter-domain",   count(state.jobs, "domain"),    "domain");
  buildCheckboxGroup("filter-company",  count(state.jobs, "company"),   "company");
  buildCheckboxGroup("filter-seniority",count(state.jobs, "seniority"), "seniority");
  buildCheckboxGroup("filter-worktype", count(state.jobs, "workType"),  "workType");
  buildCheckboxGroup("filter-emptype",  count(state.jobs, "employmentType"), "empType");

  // Tech — flatten array field
  const techCount = {};
  state.jobs.forEach(j => (j.techStack || []).forEach(t => techCount[t] = (techCount[t]||0)+1));
  buildCheckboxGroup("filter-tech", techCount, "tech");
}

function buildCheckboxGroup(containerId, countMap, filterKey) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const sorted = Object.entries(countMap).sort((a,b) => b[1]-a[1]);
  const hasSearch = sorted.length > 5;

  const checkboxesHtml = sorted.map(([label, count]) =>
    '<label class="filter-check" data-label="' + esc(label.toLowerCase()) + '">' +
    '<input type="checkbox" name="' + filterKey + '" value="' + esc(label) + '" />' +
    esc(label) +
    '<span class="count">' + count + '</span>' +
    '</label>'
  ).join("");

  container.innerHTML = (hasSearch
    ? '<div class="filter-search-wrap"><input type="search" class="filter-search-input" placeholder="Search\u2026" aria-label="Search ' + filterKey + ' options" autocomplete="off" /></div>'
    : "") + checkboxesHtml;

  if (hasSearch) {
    const si = container.querySelector(".filter-search-input");
    si.addEventListener("input", () => {
      const q = si.value.toLowerCase().trim();
      container.querySelectorAll(".filter-check").forEach(el => {
        el.style.display = (!q || el.dataset.label.includes(q)) ? "" : "none";
      });
    });
  }

  container.querySelectorAll("input[type=checkbox]").forEach(cb => {
    cb.addEventListener("change", () => onFilterChange(filterKey, cb.value, cb.checked));
  });
}

/* ══════════════════════════════════════════
   FILTER LOGIC
══════════════════════════════════════════ */
function onFilterChange(key, value, checked) {
  const map = {
    domain:    "domains",
    company:   "companies",
    seniority: "seniorities",
    workType:  "workTypes",
    empType:   "empTypes",
    exp:       "expBuckets",
    tech:      "tech",
  };
  const setKey = map[key];
  if (!setKey) return;
  if (checked) state.filters[setKey].add(value);
  else         state.filters[setKey].delete(value);
  state.page = 1;
  applyFilters();
  renderActivePills();
}

// Wire up static experience checkboxes
document.querySelectorAll("input[name='exp']").forEach(cb => {
  cb.addEventListener("change", () => onFilterChange("exp", cb.value, cb.checked));
});

function applyFilters() {
  const f = state.filters;
  const q = f.search.toLowerCase().trim();

  state.filtered = state.jobs.filter(job => {
    // Text search
    if (q) {
      const haystack = `${job.title} ${job.company} ${job.domain} ${(job.techStack||[]).join(" ")} ${job.summary}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (f.domains.size     && !f.domains.has(job.domain))          return false;
    if (f.companies.size   && !f.companies.has(job.company))       return false;
    if (f.seniorities.size && !f.seniorities.has(job.seniority))   return false;
    if (f.workTypes.size   && !f.workTypes.has(job.workType))      return false;
    if (f.empTypes.size    && !f.empTypes.has(job.employmentType)) return false;

    // Experience buckets
    if (f.expBuckets.size) {
      const min = job.experience?.min;
      const match = [...f.expBuckets].some(bucket => {
        if (bucket === "unspecified") return min == null;
        const [lo, hi] = bucket.split("-").map(Number);
        return min != null && min >= lo && min < hi;
      });
      if (!match) return false;
    }

    // Tech stack
    if (f.tech.size) {
      const stack = job.techStack || [];
      if (![...f.tech].some(t => stack.includes(t))) return false;
    }

    return true;
  });

  // Sort
  sortJobs();

  // Update results count
  const total = state.filtered.length;
  document.getElementById("results-count").innerHTML =
    `Showing <strong>${Math.min(state.page * PAGE_SIZE, total)}</strong> of <strong>${total}</strong> jobs`;

  renderJobsPage();

  // Show/hide empty state
  document.getElementById("empty-state").classList.toggle("hidden", total > 0);
  document.getElementById("jobs-grid").style.display = total > 0 ? (state.view === "list" ? "grid" : "grid") : "none";
}

function sortJobs() {
  state.filtered.sort((a, b) => {
    switch (state.sort) {
      case "newest":  return String(b.postedAt||"").localeCompare(String(a.postedAt||""));
      case "oldest":  return String(a.postedAt||"").localeCompare(String(b.postedAt||""));
      case "company": return a.company.localeCompare(b.company);
      case "title":   return a.title.localeCompare(b.title);
      default:        return 0;
    }
  });
}

/* ══════════════════════════════════════════
   RENDER JOBS
══════════════════════════════════════════ */
function renderJobsPage() {
  const grid = document.getElementById("jobs-grid");
  const slice = state.filtered.slice(0, state.page * PAGE_SIZE);
  grid.innerHTML = slice.map(renderJobCard).join("");

  // Bind card clicks
  grid.querySelectorAll(".job-card").forEach((el, i) => {
    const job = state.filtered[i];
    el.addEventListener("click", () => openModal(job));
    el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openModal(job); } });
  });

  // Bind apply buttons (stop propagation so card click doesn't also fire)
  grid.querySelectorAll(".card-apply-btn").forEach((btn, i) => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      window.open(state.filtered[i].applyUrl, "_blank", "noopener");
    });
  });

  // Load more button
  const btn = document.getElementById("load-more-btn");
  const hasMore = state.page * PAGE_SIZE < state.filtered.length;
  btn.classList.toggle("hidden", !hasMore);
  btn.onclick = () => { state.page++; applyFilters(); };
}

function renderJobCard(job) {
  const initials  = companyInitials(job.company);
  const color     = companyColor(job.companyId || job.company);
  const coData    = state.companies.find(c => c.id === job.companyId);
  const logoSrc   = getLogoSrc(coData);   // keyless Google favicon service
  const posted    = job.postedAt ? formatDate(job.postedAt) : "";
  const expLabel  = job.experience?.label || "";
  const tech      = (job.techStack || []).slice(0, 4);
  const hasDeadline = job.deadline;

  // Company logo with Google favicon + initials fallback
  const logoHtml = logoSrc
    ? `<div class="company-logo" style="background:${color}11;border-color:${color}33;padding:0;overflow:hidden">
         <img src="${esc(logoSrc)}" alt="${esc(job.company)}" style="width:100%;height:100%;object-fit:contain;padding:6px"
              onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
         <span style="display:none;width:100%;height:100%;align-items:center;justify-content:center;background:${color}22;color:${color};font-weight:800;font-size:0.85rem">${initials}</span>
       </div>`
    : `<div class="company-logo" style="background:${color}22;color:${color};border-color:${color}44">${initials}</div>`;

  return `
<article class="job-card" tabindex="0" role="button"
  aria-label="${esc(job.title)} at ${esc(job.company)}">
  <div class="card-header">
    ${logoHtml}
    <div class="card-meta">
      <div class="card-company">${esc(job.company)}</div>
      <div class="card-title">${esc(job.title)}</div>
    </div>
  </div>

  <div class="card-tags">
    <span class="tag tag-domain ${domainClass(job.domain)}">${esc(job.domain)}</span>
    <span class="tag tag-seniority">${esc(job.seniority)}</span>
    <span class="tag tag-work">${workTypeIcon(job.workType)} ${esc(job.workType)}</span>
    ${tech.map(t => `<span class="tag tag-tech">${esc(t)}</span>`).join("")}
  </div>

  ${job.summary ? `<p class="card-summary">${esc(job.summary)}</p>` : ""}

  <div class="card-footer">
    <span class="card-location">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      ${esc(job.location || "Nepal")}
    </span>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px">
      ${expLabel ? `<span class="card-exp">📅 ${esc(expLabel)}</span>` : ""}
      ${posted   ? `<span class="card-posted">${posted}</span>` : ""}
      ${hasDeadline ? `<span class="card-posted" style="color:var(--warning)">Due: ${esc(job.deadline)}</span>` : ""}
    </div>
  </div>

  <button class="card-apply-btn" aria-label="Apply for ${esc(job.title)}">Apply →</button>
</article>`;
}

function workTypeIcon(wt) {
  if (wt === "Remote")  return "🌐";
  if (wt === "Hybrid")  return "🔀";
  return "🏢";
}

/* ══════════════════════════════════════════
   ACTIVE PILLS
══════════════════════════════════════════ */
function renderActivePills() {
  const container = document.getElementById("active-pills");
  const pills = [];

  const addPills = (set, key, label) => {
    set.forEach(v => pills.push({ label: `${label}: ${v}`, key, value: v }));
  };

  addPills(state.filters.domains,    "domain",    "Domain");
  addPills(state.filters.companies,  "company",   "Company");
  addPills(state.filters.seniorities,"seniority", "Level");
  addPills(state.filters.workTypes,  "workType",  "Work");
  addPills(state.filters.empTypes,   "empType",   "Type");
  addPills(state.filters.expBuckets, "exp",       "Exp");
  addPills(state.filters.tech,       "tech",      "Tech");

  container.innerHTML = pills.map(p => `
    <span class="pill" role="listitem" tabindex="0" data-key="${p.key}" data-value="${esc(p.value)}"
      aria-label="Remove filter ${esc(p.label)}">
      ${esc(p.label)} <span class="pill-x" aria-hidden="true">×</span>
    </span>
  `).join("");

  container.querySelectorAll(".pill").forEach(pill => {
    const remove = () => {
      const key = pill.dataset.key;
      const val = pill.dataset.value;
      // Uncheck the checkbox
      document.querySelectorAll(`input[name="${key}"][value="${val}"]`).forEach(cb => cb.checked = false);
      onFilterChange(key, val, false);
    };
    pill.addEventListener("click", remove);
    pill.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); remove(); } });
  });
}

/* ══════════════════════════════════════════
   CLEAR FILTERS
══════════════════════════════════════════ */
function clearAllFilters() {
  Object.values(state.filters).forEach(v => { if (v instanceof Set) v.clear(); });
  state.filters.search = "";
  document.getElementById("search-input").value = "";
  document.querySelectorAll(".filter-check input").forEach(cb => cb.checked = false);
  state.activeCompanyFilter = null;
  document.querySelectorAll(".company-card").forEach(c => c.classList.remove("active"));
  state.page = 1;
  applyFilters();
  renderActivePills();
}

document.getElementById("clear-filters").addEventListener("click", clearAllFilters);
document.getElementById("clear-filters-2").addEventListener("click", clearAllFilters);

/* ══════════════════════════════════════════
   SEARCH
══════════════════════════════════════════ */
function setupSearch() {
  let timer;
  document.getElementById("search-input").addEventListener("input", e => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.filters.search = e.target.value;
      state.page = 1;
      applyFilters();
    }, 220);
  });
}

/* ══════════════════════════════════════════
   SORT
══════════════════════════════════════════ */
function setupSortListener() {
  document.getElementById("sort-select").addEventListener("change", e => {
    state.sort = e.target.value;
    state.page = 1;
    applyFilters();
  });
}

/* ══════════════════════════════════════════
   VIEW TOGGLE
══════════════════════════════════════════ */
function setupViewToggle() {
  const cardBtn = document.getElementById("view-cards");
  const listBtn = document.getElementById("view-list");
  const grid    = document.getElementById("jobs-grid");

  cardBtn.addEventListener("click", () => {
    state.view = "cards";
    grid.classList.remove("list-view");
    cardBtn.classList.add("active"); cardBtn.setAttribute("aria-pressed","true");
    listBtn.classList.remove("active"); listBtn.setAttribute("aria-pressed","false");
  });
  listBtn.addEventListener("click", () => {
    state.view = "list";
    grid.classList.add("list-view");
    listBtn.classList.add("active"); listBtn.setAttribute("aria-pressed","true");
    cardBtn.classList.remove("active"); cardBtn.setAttribute("aria-pressed","false");
  });
}

/* ══════════════════════════════════════════
   MODAL
══════════════════════════════════════════ */
function openModal(job) {
  const company = state.companies.find(c => c.id === job.companyId) || {};
  const logo = getLogoSrc(company);
  const color    = companyColor(job.companyId || job.company);
  const tech     = job.techStack || [];

  const body = document.getElementById("modal-body");
  body.innerHTML = `
    <div class="modal-company-header">
      <div class="modal-logo" style="background:${color}22;color:${color};border-color:${color}44"><img src="${logo}" alt="${esc(job.company)}" onerror="this.style.display='none'"></div>
      <div>
        <div class="modal-company-name">${esc(job.company)}</div>
        <div class="modal-title">${esc(job.title)}</div>
      </div>
    </div>

    <div class="modal-tags">
      <span class="tag tag-domain ${domainClass(job.domain)}">${esc(job.domain)}</span>
      <span class="tag tag-seniority">${esc(job.seniority)}</span>
      <span class="tag tag-work">${workTypeIcon(job.workType)} ${esc(job.workType)}</span>
      <span class="tag tag-emptype">${esc(job.employmentType)}</span>
      ${job.experience?.label !== "Not specified" ? `<span class="tag" style="background:rgba(124,58,237,0.12);color:var(--c-violet-l);border:1px solid rgba(124,58,237,0.2)">📅 ${esc(job.experience?.label)}</span>` : ""}
    </div>

    <div class="modal-grid">
      <div class="modal-info-box">
        <div class="modal-info-label">Location</div>
        <div class="modal-info-value">📍 ${esc(job.location || "Nepal")}</div>
      </div>
      <div class="modal-info-box">
        <div class="modal-info-label">Posted</div>
        <div class="modal-info-value">${job.postedAt ? formatDateFull(job.postedAt) : "—"}</div>
      </div>
      <div class="modal-info-box">
        <div class="modal-info-label">Deadline</div>
        <div class="modal-info-value" style="${job.deadline ? "color:var(--warning)" : ""}">${esc(job.deadline || "Open")}</div>
      </div>
      <div class="modal-info-box">
        <div class="modal-info-label">Source</div>
        <div class="modal-info-value">${esc(job.source || "Careers page")}</div>
      </div>
    </div>

    ${tech.length ? `
    <div class="modal-section">
      <h3 class="modal-section-title">Tech Stack</h3>
      <div class="modal-tech-list">
        ${tech.map(t => `<span class="modal-tech-pill">${esc(t)}</span>`).join("")}
      </div>
    </div>` : ""}

    ${job.descriptionHtml ? `
    <div class="modal-section">
      <h3 class="modal-section-title">Role Description</h3>
      <div class="modal-html-content">${sanitizeHtml(job.descriptionHtml)}</div>
    </div>` : job.summary ? `
    <div class="modal-section">
      <h3 class="modal-section-title">Role Description</h3>
      <div class="modal-html-content"><p>${esc(job.summary)}</p></div>
    </div>` : ""}

    ${job.requirementsHtml ? `
    <div class="modal-section">
      <h3 class="modal-section-title">Requirements</h3>
      <div class="modal-html-content">${sanitizeHtml(job.requirementsHtml)}</div>
    </div>` : ""}

    <div class="modal-section">
      <h3 class="modal-section-title">How to Apply</h3>
      <div class="modal-apply-box">
        <p class="modal-apply-how">${esc(job.applyHow || "Visit the company careers page to apply.")}</p>
        <div class="modal-apply-actions">
          <a href="${esc(job.applyUrl)}" target="_blank" rel="noopener noreferrer" class="btn-apply-primary">
            Apply Now →
          </a>
          <a href="${esc(company.displayCareersUrl || job.careersUrl || job.applyUrl)}" target="_blank" rel="noopener noreferrer" class="btn-apply-secondary">
            All openings
          </a>
          ${job.applyEmail ? `<a href="mailto:${esc(job.applyEmail)}" class="btn-apply-secondary">✉️ ${esc(job.applyEmail)}</a>` : ""}
        </div>
      </div>
    </div>

    <!-- Apply through Alok referral section -->
    <div class="referral-box">
      <div class="referral-box-header">
        <span class="referral-badge">🌟 Boost Your Chances</span>
        <span class="referral-tag">Free</span>
      </div>
      <h4 class="referral-title">Apply Through Alok</h4>
      <p class="referral-desc">Get a direct edge — Alok personally reviews your CV, provides tailored suggestions, and where possible, puts in a word with the hiring team. Referred applicants often rank higher in the screening process.</p>
      <ul class="referral-benefits">
        <li>📄 CV review &amp; targeted feedback</li>
        <li>💬 Role-specific application tips</li>
        <li>🔗 Warm introduction to the hiring team (where applicable)</li>
        <li>📈 Higher interview shortlist likelihood</li>
      </ul>
      <a href="mailto:referme@aloks.com.np?subject=${encodeURIComponent('Referral: ' + job.title + ' @ ' + job.company)}&body=${encodeURIComponent('Hi Alok,\n\nI found this role on NepaliTJobs and would love your support to apply:\n\n  Role: ' + job.title + '\n  Company: ' + job.company + '\n  Job URL: ' + job.applyUrl + '\n\nPlease find my CV attached. Thank you!')}" class="btn-referral">
        ✉️ Request Referral from Alok
      </a>
    </div>

    ${company.about ? `
    <div class="modal-section">
      <h3 class="modal-section-title">About ${esc(job.company)}</h3>
      <div class="company-about-box">
        <p>${esc(company.about)}</p>
        <div class="company-detail-pills">
          ${company.hq       ? `<span class="company-detail-pill">🏢 ${esc(company.hq)}</span>` : ""}
          ${company.size     ? `<span class="company-detail-pill">👥 ${esc(company.size)} people</span>` : ""}
          ${company.founded  ? `<span class="company-detail-pill">📅 Founded ${company.founded}</span>` : ""}
          ${company.industry ? `<span class="company-detail-pill">🔖 ${esc(company.industry)}</span>` : ""}
          ${company.website  ? `<a href="${esc(company.website)}" target="_blank" rel="noopener" class="company-detail-pill" style="color:var(--c-violet-l)">🌐 Website</a>` : ""}
        </div>
      </div>
    </div>` : ""}
  `;

  const overlay = document.getElementById("modal-overlay");
  overlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  document.getElementById("modal-panel").scrollTop = 0;
  document.getElementById("modal-close").focus();
}

function closeModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
  document.body.style.overflow = "";
}

function setupModalClose() {
  document.getElementById("modal-close").addEventListener("click", closeModal);
  document.getElementById("modal-overlay").addEventListener("click", e => {
    if (e.target === document.getElementById("modal-overlay")) closeModal();
  });
}

/* ══════════════════════════════════════════
   COMPANIES SECTION
══════════════════════════════════════════ */
function renderCompanies() {
  const grid = document.getElementById("companies-grid");
  const jobsByCompany = {};
  state.jobs.forEach(j => { jobsByCompany[j.companyId] = (jobsByCompany[j.companyId]||0)+1; });

  grid.innerHTML = state.companies.map(c => {
    const initials = companyInitials(c.name);
    const color    = companyColor(c.id);
    const count    = jobsByCompany[c.id] || 0;
    const logoSrc  = getLogoSrc(c);     // keyless Google favicon service
    const logoHtml = logoSrc
      ? `<div class="company-initials" style="background:${color}11;border-color:${color}33;padding:0;overflow:hidden">
           <img src="${esc(logoSrc)}" alt="${esc(c.name)}" style="width:100%;height:100%;object-fit:contain;padding:5px"
                onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
           <span style="display:none;width:100%;height:100%;align-items:center;justify-content:center;background:${color}22;color:${color};font-weight:800;font-size:0.75rem">${initials}</span>
         </div>`
      : `<div class="company-initials" style="background:${color}22;color:${color};border-color:${color}44">${initials}</div>`;
    return `
<div class="company-card" data-id="${esc(c.id)}" tabindex="0" role="button"
  aria-label="${esc(c.name)}, ${count} open jobs">
  <div class="company-card-header">
    ${logoHtml}
    <div>
      <div class="company-name">${esc(c.name)}</div>
      <div class="company-industry">${esc(c.industry || "")}</div>
    </div>
  </div>
  <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
    <span class="company-job-count">${count} open role${count !== 1 ? "s" : ""}</span>
    <a href="companies.html#${esc(c.id)}" style="font-size:0.7rem;color:var(--c-violet-l);font-weight:700;white-space:nowrap" onclick="event.stopPropagation()">Profile →</a>
  </div>
</div>`;
  }).join("");

  grid.querySelectorAll(".company-card").forEach(card => {
    const click = () => {
      const id = card.dataset.id;
      const company = state.companies.find(c => c.id === id);
      if (!company) return;

      if (state.activeCompanyFilter === id) {
        // Toggle off
        state.activeCompanyFilter = null;
        state.filters.companies.clear();
        card.classList.remove("active");
      } else {
        state.activeCompanyFilter = id;
        state.filters.companies.clear();
        state.filters.companies.add(company.name);
        document.querySelectorAll(".company-card").forEach(c => c.classList.remove("active"));
        card.classList.add("active");
        // Sync checkbox if visible
        document.querySelectorAll(`input[name="company"]`).forEach(cb => {
          cb.checked = cb.value === company.name;
        });
      }

      state.page = 1;
      applyFilters();
      renderActivePills();
      document.getElementById("jobs-section").scrollIntoView({ behavior: "smooth" });
    };

    card.addEventListener("click", click);
    card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); click(); } });
  });
}

/* ══════════════════════════════════════════
   MOBILE FILTER PANEL
══════════════════════════════════════════ */
function closeMobileFilter() {
  const panel   = document.getElementById("filters-panel");
  const overlay = document.getElementById("filter-overlay");
  const btn     = document.getElementById("mobile-filter-btn");
  panel.classList.remove("open");
  if (overlay) { overlay.classList.remove("active"); }
  if (btn)     { btn.setAttribute("aria-expanded", "false"); }
  document.body.style.overflow = "";
}

function setupMobileFilter() {
  const btn     = document.getElementById("mobile-filter-btn");
  const panel   = document.getElementById("filters-panel");
  const overlay = document.getElementById("filter-overlay");

  btn.addEventListener("click", () => {
    const open = panel.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
    if (overlay) { overlay.classList.toggle("active", open); }
  });

  if (overlay) { overlay.addEventListener("click", closeMobileFilter); }

  const cb1 = document.getElementById("filter-panel-close");
  const cb2 = document.getElementById("filter-panel-close-2");
  if (cb1) cb1.addEventListener("click", closeMobileFilter);
  if (cb2) cb2.addEventListener("click", closeMobileFilter);
}

/* ══════════════════════════════════════════
   FILTER ACCORDIONS
══════════════════════════════════════════ */
function setupFilterAccordions() {
  document.querySelectorAll(".filter-group-header").forEach(btn => {
    btn.addEventListener("click", () => {
      const expanded = btn.getAttribute("aria-expanded") === "true";
      const targetId = btn.getAttribute("aria-controls");
      const target   = document.getElementById(targetId);
      btn.setAttribute("aria-expanded", String(!expanded));
      if (target) target.classList.toggle("hidden", expanded);
    });
  });
}

/* ══════════════════════════════════════════
   UTILITIES
══════════════════════════════════════════ */
function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Very light HTML sanitiser — strips script/on* but preserves
 * structural HTML (ul, li, p, h4, strong, span) from the job descriptions.
 */
function sanitizeHtml(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/ style="color:[^"]{0,60}"/gi, ""); // strip colour overrides
}

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return "";
    return d.toLocaleDateString("en-NP", { month: "short", day: "numeric" });
  } catch { return ""; }
}

function formatDateFull(dateStr) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return "—";
    return d.toLocaleDateString("en-NP", { year: "numeric", month: "short", day: "numeric" });
  } catch { return "—"; }
}

function companyInitials(name) {
  return String(name)
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || "")
    .join("");
}

const PALETTE = [
  "#e8264a","#7c3aed","#2563eb","#0891b2","#059669",
  "#d97706","#db2777","#7c3aed","#0e7490","#b45309",
  "#4f46e5","#be123c","#15803d","#6d28d9","#92400e",
];

function companyColor(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

/**
 * Returns a logo image URL using Google's keyless favicon service.
 * Falls back gracefully — onerror in the template shows initials instead.
 * No API key required. Derives the domain from company.website.
 */
function getLogoSrc(company) {
  if (!company?.website) return "";
  try {
    const domain = new URL(company.website).hostname;
    return `https://www.google.com/s2/favicons?sz=128&domain_url=https://${domain}`;
  } catch { return ""; }
}
