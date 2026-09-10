/**
 * companies.js — Nepal IT Company Directory
 * Loads data/companies.json + data/jobs.json, renders company cards,
 * interactive Leaflet map, compare bar, side-by-side comparison table,
 * and detail side panel.
 *
 * Made with ❤️ in 🇳🇵 by Alok — hello@aloks.com.np
 */

"use strict";

// ── Palette — deterministic accent per company ─────────────────────
const PALETTES = [
  { bg: "#e8264a", text: "#fff" }, { bg: "#7c3aed", text: "#fff" },
  { bg: "#0ea5e9", text: "#fff" }, { bg: "#10b981", text: "#fff" },
  { bg: "#f59e0b", text: "#111" }, { bg: "#ec4899", text: "#fff" },
  { bg: "#8b5cf6", text: "#fff" }, { bg: "#06b6d4", text: "#fff" },
  { bg: "#f97316", text: "#fff" }, { bg: "#84cc16", text: "#111" },
];

function companyPalette(id) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xFFFF;
  return PALETTES[h % PALETTES.length];
}

function companyInitials(name) {
  const words = name.replace(/[()[\]]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function employeeRankOf(range) {
  // For sorting largest first
  const map = { "11-50": 1, "51-200": 2, "201-500": 3, "1000+": 4 };
  return map[range] ?? 0;
}

/**
 * Returns a logo image URL using Google's keyless favicon service.
 * Falls back gracefully — onerror shows initials instead.
 * No API key required.
 */
function getLogoSrc(company) {
  if (!company?.website) return "";
  try {
    const domain = new URL(company.website).hostname;
    return `https://www.google.com/s2/favicons?sz=128&domain_url=https://${domain}`;
  } catch { return ""; }
}

// ── State ──────────────────────────────────────────────────────────
const state = {
  companies: [],
  jobs: [],
  jobCountByCompany: {},   // { companyId: count }
  compareSet: new Set(),   // up to 3 company IDs
  filteredIds: [],
  activeDetail: null,
  map: null,
  markers: {},
};

// ── Init ───────────────────────────────────────────────────────────
async function init() {
  document.getElementById("year").textContent = new Date().getFullYear();
  setupTheme();

  const [companies, jobsPayload] = await Promise.all([
    fetch("data/companies.json").then(r => r.json()),
    fetch("data/jobs.json").then(r => r.json()).catch(() => ({ jobs: [] })),
  ]);

  state.companies = companies;
  state.jobs      = jobsPayload.jobs ?? [];

  // Build job count lookup
  for (const job of state.jobs) {
    state.jobCountByCompany[job.companyId] = (state.jobCountByCompany[job.companyId] ?? 0) + 1;
  }

  populateIndustryFilter();
  renderStats();
  initMap();
  applyFilters();
  setupControls();
  setupCompareBar();
  setupModal();
  setupDetailPanel();
  setupMapToggle();

  // Scroll to company if URL hash matches
  const hash = location.hash.slice(1);
  if (hash) {
    const c = state.companies.find(c => c.id === hash);
    if (c) setTimeout(() => openDetail(c), 400);
  }
}

// ── Theme ──────────────────────────────────────────────────────────
function setupTheme() {
  const btn  = document.getElementById("theme-toggle");
  const root = document.documentElement;
  const saved = localStorage.getItem("theme") || "dark";
  root.setAttribute("data-theme", saved);
  btn?.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    if (state.map) state.map.invalidateSize();
  });
}

// ── Stats ──────────────────────────────────────────────────────────
function renderStats() {
  const total      = state.companies.length;
  const openRoles  = state.jobs.length;
  const healthcare = state.companies.filter(c =>
    c.industry?.toLowerCase().includes("health")).length;
  const product    = state.companies.filter(c => c.type === "Product").length;

  document.getElementById("ds-companies").textContent = total;
  document.getElementById("ds-jobs").textContent = openRoles;
  document.getElementById("ds-healthcare").textContent = healthcare;
  document.getElementById("ds-product").textContent = product;
}

// ── Industry filter population ─────────────────────────────────────
function populateIndustryFilter() {
  const sel = document.getElementById("filter-industry");
  const industries = new Set();
  for (const c of state.companies) {
    if (c.industry) industries.add(c.industry.split("·")[0].trim());
  }
  [...industries].sort().forEach(ind => {
    const o = document.createElement("option");
    o.value = ind; o.textContent = ind;
    sel.appendChild(o);
  });
}

// ── Leaflet Map ────────────────────────────────────────────────────
function initMap() {
  // Use keyless OpenStreetMap tiles - dark mode is styled smoothly via CSS filter
  const tileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  const tileAttr = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

  state.map = L.map("nepal-map", { zoomControl: true, scrollWheelZoom: false })
    .setView([27.7, 85.0], 8);

  L.tileLayer(tileUrl, { attribution: tileAttr, maxZoom: 19 }).addTo(state.map);

  for (const company of state.companies) {
    if (!company.coordinates) continue;
    addMarker(company);
  }
}

function addMarker(company) {
  const [lat, lng] = company.coordinates;
  const pal = companyPalette(company.id);
  const initials = companyInitials(company.name);
  const logo = getLogoSrc(company) || company.logoUrl;

  const markerHtml = `
    <div class="lf-marker" style="border-color:${pal.bg};" title="${company.name}">
      ${logo
        ? `<img src="${logo}" alt="${company.name} logo" loading="lazy"
                onerror="this.onerror=null;this.parentElement.style.background='${pal.bg}';this.parentElement.style.color='${pal.text}';this.parentElement.innerHTML='<span>${initials}</span>';" />`
        : `<span style="color:${pal.text};background:${pal.bg};width:100%;height:100%;display:flex;align-items:center;justify-content:center;">${initials}</span>`}
    </div>`;

  const icon = L.divIcon({
    html: markerHtml,
    className: "lf-custom-icon",
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
  });

  const jobCount = state.jobCountByCompany[company.id] ?? 0;
  const techPills = (company.techStack ?? []).slice(0, 3)
    .map(t => `<span class="map-popup-tag">${t}</span>`).join("");

  const popupLogo = logo
    ? `<img src="${logo}" alt="${company.name}" onerror="this.parentElement.textContent='${initials}'" />`
    : `<span style="font-weight:700;color:${pal.text};background:${pal.bg};width:100%;height:100%;display:flex;align-items:center;justify-content:center;">${initials}</span>`;

  const popup = L.popup({ className: "lf-popup", maxWidth: 260, closeButton: true })
    .setContent(`
      <div class="map-popup">
        <div class="map-popup-header">
          <div class="map-popup-logo">${popupLogo}</div>
          <div>
            <div class="map-popup-name">${company.name}</div>
            <div class="map-popup-loc">📍 ${company.location}</div>
          </div>
        </div>
        <div class="map-popup-tags">${techPills}</div>
        <div class="map-popup-quick-links">
          ${company.website ? `<a href="${company.website}" target="_blank" rel="noopener" class="map-popup-link" title="Company Website">🌐 Web</a>` : ""}
          ${company.careersUrl ? `<a href="${company.careersUrl}" target="_blank" rel="noopener" class="map-popup-link" title="Careers Page">💼 Careers</a>` : ""}
          ${company.linkedinUrl ? `<a href="${company.linkedinUrl}" target="_blank" rel="noopener" class="map-popup-link" title="LinkedIn Profile">👔 LinkedIn</a>` : ""}
        </div>
        ${jobCount ? `<div style="font-size:0.75rem;color:var(--c-violet-l);margin-bottom:8px">💼 ${jobCount} open role${jobCount > 1 ? "s" : ""}</div>` : ""}
        <button class="map-popup-btn" onclick="openDetailById('${company.id}')">View company profile →</button>
      </div>`);

  const marker = L.marker([lat, lng], { icon }).bindPopup(popup).addTo(state.map);
  state.markers[company.id] = marker;
}

function openDetailById(id) {
  const c = state.companies.find(c => c.id === id);
  if (c) openDetail(c);
}
window.openDetailById = openDetailById; // exposed for Leaflet popup onclick

function applyFilters() {
  const q    = document.getElementById("dir-search")?.value.toLowerCase() ?? "";
  const type = document.getElementById("filter-type")?.value ?? "";
  const loc  = document.getElementById("filter-location")?.value.toLowerCase() ?? "";
  const size = document.getElementById("filter-size")?.value ?? "";
  const ind  = document.getElementById("filter-industry")?.value ?? "";
  const sort = document.getElementById("sort-dir")?.value ?? "name";

  let list = state.companies.filter(c => {
    if (type && c.type !== type) return false;
    if (size && c.employeeRange !== size) return false;
    if (ind && !c.industry?.toLowerCase().includes(ind.toLowerCase())) return false;
    if (loc) {
      const locBlob = [c.location, c.hq].join(" ").toLowerCase();
      if (loc === "kathmandu") {
        if (!locBlob.includes("kathmandu") && !locBlob.includes("lalitpur") && !locBlob.includes("bhaktapur") && !locBlob.includes("sanepa") && !locBlob.includes("pulchowk") && !locBlob.includes("bakhundole") && !locBlob.includes("sifal") && !locBlob.includes("baneshwor")) return false;
      } else {
        if (!locBlob.includes(loc)) return false;
      }
    }
    if (q) {
      const blob = [c.name, c.industry, c.about, c.location, ...(c.techStack ?? []), ...(c.clientTypes ?? [])].join(" ").toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });

  // Sort
  list.sort((a, b) => {
    if (sort === "name")    return a.name.localeCompare(b.name);
    if (sort === "founded") return (a.founded ?? 9999) - (b.founded ?? 9999);
    if (sort === "size")    return employeeRankOf(b.employeeRange) - employeeRankOf(a.employeeRange);
    if (sort === "jobs")    return (state.jobCountByCompany[b.id] ?? 0) - (state.jobCountByCompany[a.id] ?? 0);
    return 0;
  });

  state.filteredIds = list.map(c => c.id);
  document.getElementById("dir-count").textContent = `${list.length} of ${state.companies.length} companies`;
  document.getElementById("dir-empty")?.classList.toggle("hidden", list.length > 0);
  renderGrid(list);
}

function setupControls() {
  let debounce;
  document.getElementById("dir-search")?.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(applyFilters, 220);
  });
  ["filter-type", "filter-location", "filter-size", "filter-industry", "sort-dir"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", applyFilters);
  });
}

// ── Grid rendering ─────────────────────────────────────────────────
function renderGrid(companies) {
  const grid = document.getElementById("dir-grid");
  grid.innerHTML = "";
  for (const c of companies) grid.appendChild(makeCard(c));
}

function makeCard(company) {
  const pal = companyPalette(company.id);
  const initials = companyInitials(company.name);
  const jobCount = state.jobCountByCompany[company.id] ?? 0;
  const isComparing = state.compareSet.has(company.id);

  const card = document.createElement("article");
  card.className = `dir-card${isComparing ? " selected" : ""}`;
  card.setAttribute("tabindex", "0");
  card.setAttribute("data-id", company.id);
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `${company.name} company profile`);

  const techPills = (company.techStack ?? []).slice(0, 5)
    .map(t => `<span class="dir-tech-tag">${t}</span>`).join("");

  const clientList = (company.clientTypes ?? []).slice(0, 2).join(", ");

  const typeCls = `type-${(company.type || "Services").replace(/\s+/g, "")}`;

  const formerNote = company.formerNames?.length
    ? `<div class="dir-card-former">formerly ${company.formerNames.join(" · ")}</div>` : "";

  const directoryBadge = company.directoryOnly
    ? `<span class="dir-card-only-badge">Directory</span>` : "";

  const logo = getLogoSrc(company) || company.logoUrl;

  card.innerHTML = `
    ${directoryBadge}
    <div class="card-compare-wrap">
      <input type="checkbox" class="card-compare-cb" title="Add to compare" aria-label="Compare ${company.name}"
        ${isComparing ? "checked" : ""} data-id="${company.id}" />
    </div>
    <div class="dir-card-banner"></div>
    <div class="dir-card-body">
      <div class="dir-card-header">
        <div class="dir-logo" style="border-color:${pal.bg}22">
          <img src="${logo ?? ""}" alt="${company.name} logo"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
               ${logo ? "" : 'style="display:none"'} />
          <span class="logo-initials"
                style="display:${logo ? "none" : "flex"};color:${pal.text};background:${pal.bg};width:100%;height:100%;border-radius:11px;align-items:center;justify-content:center">
            ${initials}
          </span>
        </div>
        <div class="dir-card-name-wrap">
          <div class="dir-card-name">${company.name}</div>
          ${formerNote}
          <div class="dir-card-industry">${company.industry ?? ""}</div>
        </div>
        <span class="type-badge ${typeCls}">${company.type ?? "Services"}</span>
      </div>

      <div class="dir-meta-row">
        <span class="dir-meta-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.657 16.657L13.414 20.9a2 2 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z"/><circle cx="12" cy="11" r="3"/></svg>
          ${company.location}
        </span>
        ${company.founded ? `<span class="dir-meta-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg>
          Est. ${company.founded}
        </span>` : ""}
        ${company.size ? `<span class="dir-meta-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          ${company.size}
        </span>` : ""}
      </div>

      ${techPills ? `<div class="dir-tech-row">${techPills}</div>` : ""}

      ${clientList ? `
        <div class="dir-clients">
          <div class="dir-clients-label">Serves</div>
          ${clientList}${(company.clientTypes?.length ?? 0) > 2 ? " & more" : ""}
        </div>` : ""}

      <div class="dir-links-row">
        ${company.website ? `
          <a href="${company.website}" target="_blank" rel="noopener" class="dir-link-item" title="Visit Website" onclick="event.stopPropagation()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            Website
          </a>` : ""}
        ${company.careersUrl ? `
          <a href="${company.careersUrl}" target="_blank" rel="noopener" class="dir-link-item" title="Careers Page" onclick="event.stopPropagation()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            Careers
          </a>` : ""}
        ${company.linkedinUrl ? `
          <a href="${company.linkedinUrl}" target="_blank" rel="noopener" class="dir-link-item dir-link-linkedin" title="LinkedIn Profile" onclick="event.stopPropagation()">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.45c-.9 0-1.63.73-1.63 1.63 0 .9.73 1.63 1.63 1.63.9 0 1.63-.73 1.63-1.63 0-.9-.73-1.63-1.63-1.63z"/></svg>
            LinkedIn
          </a>` : ""}
      </div>
    </div>
    <div class="dir-card-footer">
      <span class="dir-jobs-badge">${jobCount > 0 ? `💼 ${jobCount} open role${jobCount > 1 ? "s" : ""}` : "No listings"}</span>
      <div class="dir-actions">
        ${jobCount > 0 ? `<a class="dir-btn-sm dir-btn-ghost" href="index.html#company=${company.id}" title="View jobs">Jobs →</a>` : ""}
        <button class="dir-btn-sm dir-btn-primary" data-action="detail" data-id="${company.id}">Profile</button>
      </div>
    </div>`;

  // Events
  card.addEventListener("click", e => {
    if (e.target.classList.contains("card-compare-cb")) return; // handled separately
    if (e.target.dataset.action === "detail" || e.target.closest("[data-action='detail']")) {
      openDetail(company);
      return;
    }
    if (e.target.tagName === "A") return;
    openDetail(company);
  });

  card.addEventListener("keydown", e => {
    if (e.key === "Enter") openDetail(company);
  });

  const cb = card.querySelector(".card-compare-cb");
  cb?.addEventListener("change", e => {
    e.stopPropagation();
    toggleCompare(company.id);
  });

  return card;
}

// ── Logo helper for panels ────────────────────────────────────────
function logoHtml(company, size = 52, radius = 12) {
  const pal = companyPalette(company.id);
  const initials = companyInitials(company.name);
  const logo = getLogoSrc(company) || company.logoUrl;
  return `
    <div style="width:${size}px;height:${size}px;border-radius:${radius}px;background:var(--surface);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0">
      <img src="${logo ?? ""}" alt="${company.name} logo"
           style="width:100%;height:100%;object-fit:contain;padding:${Math.round(size/8)}px"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
           ${logo ? "" : 'style="display:none"'} />
      <span style="display:${logo ? "none" : "flex"};width:100%;height:100%;border-radius:${radius - 1}px;align-items:center;justify-content:center;font-family:var(--font-head);font-weight:800;font-size:${Math.round(size/3.5)}px;background:${pal.bg};color:${pal.text}">
        ${initials}
      </span>
    </div>`;
}

// ── Detail panel ──────────────────────────────────────────────────
function setupDetailPanel() {
  document.getElementById("detail-close")?.addEventListener("click", closeDetail);
  document.getElementById("detail-overlay")?.addEventListener("click", closeDetail);
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { closeDetail(); closeCompareModal(); }
  });
}

function openDetail(company) {
  state.activeDetail = company.id;
  const jobCount = state.jobCountByCompany[company.id] ?? 0;
  const pal = companyPalette(company.id);

  const techPills = (company.techStack ?? [])
    .map(t => `<span class="detail-pill">${t}</span>`).join("");
  const clientPills = (company.clientTypes ?? [])
    .map(t => `<span class="detail-pill">${t}</span>`).join("");
  const formerNote = company.formerNames?.length
    ? `<div class="detail-former">Formerly: ${company.formerNames.join(" · ")}</div>` : "";

  document.getElementById("detail-body").innerHTML = `
    <div class="detail-logo-wrap">
      ${logoHtml(company, 64, 14)}
      <div>
        <div class="detail-name">${company.name}</div>
        ${formerNote}
      </div>
    </div>

    <div class="detail-grid">
      <div class="detail-box"><div class="detail-box-label">Type</div><div class="detail-box-value">${company.type ?? "—"}</div></div>
      <div class="detail-box"><div class="detail-box-label">Founded</div><div class="detail-box-value">${company.founded ?? "—"}</div></div>
      <div class="detail-box"><div class="detail-box-label">Team size</div><div class="detail-box-value">${company.size ?? "—"}</div></div>
      <div class="detail-box"><div class="detail-box-label">Open roles</div><div class="detail-box-value" style="color:var(--c-violet-l)">${jobCount || "—"}</div></div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">Headquarters</div>
      <div class="detail-about">${company.hq ?? company.location ?? "—"}</div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">About</div>
      <div class="detail-about">${company.about ?? "—"}</div>
    </div>

    ${company.industry ? `
    <div class="detail-section">
      <div class="detail-section-title">Industry</div>
      <div class="detail-about">${company.industry}</div>
    </div>` : ""}

    ${techPills ? `
    <div class="detail-section">
      <div class="detail-section-title">Tech stack</div>
      <div class="detail-pills">${techPills}</div>
    </div>` : ""}

    ${clientPills ? `
    <div class="detail-section">
      <div class="detail-section-title">Serves</div>
      <div class="detail-pills">${clientPills}</div>
    </div>` : ""}

    <div class="detail-actions">
      ${company.careersUrl ? `
        <a class="detail-btn detail-btn-primary" href="${company.careersUrl}" target="_blank" rel="noopener">
          💼 Careers Page ↗
        </a>` : ""}
      ${company.website ? `
        <a class="detail-btn detail-btn-secondary" href="${company.website}" target="_blank" rel="noopener">
          🌐 Company Website ↗
        </a>` : ""}
      ${company.linkedinUrl ? `
        <a class="detail-btn detail-btn-secondary detail-btn-linkedin" href="${company.linkedinUrl}" target="_blank" rel="noopener">
          👔 LinkedIn Profile ↗
        </a>` : ""}
      ${jobCount > 0 ? `<a class="detail-btn detail-btn-secondary" href="index.html#company=${company.id}">Browse ${jobCount} job${jobCount > 1 ? "s" : ""}</a>` : ""}
    </div>`;

  document.getElementById("detail-overlay").classList.remove("hidden");
  document.getElementById("detail-panel").classList.remove("hidden");
  document.body.style.overflow = "hidden";

  // Fly map to company
  if (company.coordinates && state.map) {
    state.map.flyTo(company.coordinates, 14, { duration: 1 });
    state.markers[company.id]?.openPopup();
  }
}

function closeDetail() {
  document.getElementById("detail-overlay").classList.add("hidden");
  document.getElementById("detail-panel").classList.add("hidden");
  document.body.style.overflow = "";
  state.activeDetail = null;
}

// ── Compare ───────────────────────────────────────────────────────
function setupCompareBar() {
  document.getElementById("compare-clear")?.addEventListener("click", () => {
    state.compareSet.clear();
    updateCompareBar();
    refreshCardStates();
  });
  document.getElementById("compare-now")?.addEventListener("click", openCompareModal);
}

function toggleCompare(id) {
  if (state.compareSet.has(id)) {
    state.compareSet.delete(id);
  } else {
    if (state.compareSet.size >= 3) {
      const first = [...state.compareSet][0];
      state.compareSet.delete(first);
    }
    state.compareSet.add(id);
  }
  updateCompareBar();
  refreshCardStates();
}

function updateCompareBar() {
  const bar   = document.getElementById("compare-bar");
  const chips = document.getElementById("compare-chips");
  const btn   = document.getElementById("compare-now");
  const ids   = [...state.compareSet];

  chips.innerHTML = ids.map(id => {
    const c = state.companies.find(c => c.id === id);
    if (!c) return "";
    const pal = companyPalette(id);
    const initials = companyInitials(c.name);
    return `
      <div class="compare-chip">
        <div class="compare-chip-logo" style="background:${pal.bg};color:${pal.text};width:20px;height:20px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:0.6rem;font-weight:800;overflow:hidden">
          <img src="${c.logoUrl ?? ""}" style="width:100%;height:100%;object-fit:contain"
               onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
          <span style="display:none">${initials}</span>
        </div>
        <span>${c.name}</span>
        <span class="compare-chip-x" data-remove="${id}" title="Remove" role="button" tabindex="0">×</span>
      </div>`;
  }).join("");

  // Remove buttons in chips
  chips.querySelectorAll(".compare-chip-x").forEach(el => {
    el.addEventListener("click", () => toggleCompare(el.dataset.remove));
    el.addEventListener("keydown", e => { if (e.key === "Enter") toggleCompare(el.dataset.remove); });
  });

  bar.classList.toggle("visible", ids.length > 0);
  btn.disabled = ids.length < 2;
}

function refreshCardStates() {
  document.querySelectorAll(".dir-card").forEach(card => {
    const id = card.dataset.id;
    const isSel = state.compareSet.has(id);
    card.classList.toggle("selected", isSel);
    const cb = card.querySelector(".card-compare-cb");
    if (cb) cb.checked = isSel;
  });
}

// ── Compare modal ─────────────────────────────────────────────────
function setupModal() {
  document.getElementById("cmp-close")?.addEventListener("click", closeCompareModal);
  document.getElementById("cmp-overlay")?.addEventListener("click", e => {
    if (e.target.id === "cmp-overlay") closeCompareModal();
  });
}

function openCompareModal() {
  const ids = [...state.compareSet];
  const companies = ids.map(id => state.companies.find(c => c.id === id)).filter(Boolean);
  if (companies.length < 2) return;

  const rows = [
    { label: "Type",       key: c => c.type ?? "—" },
    { label: "Founded",    key: c => c.founded ?? "—" },
    { label: "HQ",         key: c => c.hq ?? c.location ?? "—" },
    { label: "Size",       key: c => c.size ?? "—" },
    { label: "Industry",   key: c => c.industry ?? "—" },
    { label: "Tech stack", key: c => (c.techStack ?? []).map(t => `<span class="cmp-tag">${t}</span>`).join(""), html: true },
    { label: "Clients",    key: c => (c.clientTypes ?? []).map(t => `<span class="cmp-tag">${t}</span>`).join(""), html: true },
    {
      label: "Links",
      key: c => `
        <div style="display:flex;gap:6px;flex-direction:column;align-items:flex-start">
          ${c.website ? `<a href="${c.website}" target="_blank" rel="noopener" class="dir-btn-sm dir-btn-ghost" style="font-size:0.75rem;padding:4px 10px">🌐 Website ↗</a>` : ""}
          ${c.careersUrl ? `<a href="${c.careersUrl}" target="_blank" rel="noopener" class="dir-btn-sm dir-btn-ghost" style="font-size:0.75rem;padding:4px 10px">💼 Careers ↗</a>` : ""}
          ${c.linkedinUrl ? `<a href="${c.linkedinUrl}" target="_blank" rel="noopener" class="dir-btn-sm dir-btn-ghost" style="font-size:0.75rem;padding:4px 10px;color:#0a66c2">👔 LinkedIn ↗</a>` : ""}
        </div>`,
      html: true
    },
    { label: "Open roles", key: c => state.jobCountByCompany[c.id] ?? 0,
      render: (v) => v > 0 ? `<span class="cmp-winner">💼 ${v} open</span>` : "—" },
  ];

  const headerCols = companies.map(c => `
    <th>
      <div class="cmp-col-header">
        ${logoHtml(c, 48, 12)}
        <div class="cmp-col-name">${c.name}</div>
      </div>
    </th>`).join("");

  const bodyRows = rows.map(row => {
    const cells = companies.map(c => {
      const raw = row.key(c);
      const val = row.render ? row.render(raw) : (row.html ? `<div class="cmp-tags">${raw}</div>` : String(raw));
      return `<td>${val}</td>`;
    }).join("");
    return `<tr><th>${row.label}</th>${cells}</tr>`;
  }).join("");

  document.getElementById("cmp-body").innerHTML = `
    <table class="cmp-table">
      <thead><tr><th></th>${headerCols}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>`;

  document.getElementById("cmp-overlay").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeCompareModal() {
  document.getElementById("cmp-overlay")?.classList.add("hidden");
  document.body.style.overflow = "";
}

// ── Map toggle ────────────────────────────────────────────────────
function setupMapToggle() {
  const btn     = document.getElementById("map-toggle");
  const section = document.getElementById("map-section");
  btn?.addEventListener("click", () => {
    const collapsed = section.classList.toggle("collapsed");
    btn.textContent = collapsed ? "▼ Show map" : "▲ Collapse map";
    btn.setAttribute("aria-expanded", String(!collapsed));
    if (!collapsed && state.map) state.map.invalidateSize();
  });
}

// ── Bootstrap ─────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", init);
