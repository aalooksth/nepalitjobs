#!/usr/bin/env node
/**
 * tests/validate-map-and-locations.mjs
 * Validates map configuration, tile providers (keyless OSM),
 * company coordinates in Nepal, company links, and logo sources.
 */

import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let passed = 0, failed = 0;

function assert(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}${detail ? " — " + detail : ""}`);
    failed++;
  }
}

console.log("\n🗺️  Validating Map, Coordinates & Company Links…");

const companies = JSON.parse(await readFile(join(ROOT, "data", "companies.json"), "utf8"));
const companiesJs = await readFile(join(ROOT, "companies.js"), "utf8");

// 1. Map Tile provider verification
assert("Leaflet uses openstreetmap tiles", companiesJs.includes("tile.openstreetmap.org"));
assert("No cartocdn tiles (prevents API key required message)", !companiesJs.includes("basemaps.cartocdn.com"));

// 2. Logo rendering on markers & UI links
assert("addMarker renders company logo in custom marker", companiesJs.includes("lf-marker") && companiesJs.includes("logo"));
assert("companies.js has website/linkedin/careers link rendering", companiesJs.includes("dir-links-row") && companiesJs.includes("linkedinUrl"));

// 3. Check for specific companies
const bajra = companies.find(c => c.id === "bajra");
assert("Bajra Technologies is present in directory", !!bajra);
assert("Bajra careers URL is /jobs", bajra && bajra.careersUrl === "https://bajratechnologies.com/jobs");

const techkraft = companies.find(c => c.id === "techkraft");
assert("Techkraft Inc. is present in directory", !!techkraft);
assert("Techkraft website is techkraftinc.com", techkraft && techkraft.website.includes("techkraftinc.com"));
assert("Techkraft careers uses the live portal", techkraft && techkraft.careersUrl === "https://careers.techkraftinc.com/jobs/Careers");

const asterdio = companies.find(c => c.id === "asterdio");
assert("Asterdio is present in directory", !!asterdio);
assert("Asterdio careers is /careers", asterdio && asterdio.careersUrl === "https://asterdio.com/careers");

const growbydata = companies.find(c => c.id === "growbydata");
assert("GrowByData is present in directory", !!growbydata);
assert("GrowByData careers is /career-overview/", growbydata && growbydata.careersUrl === "https://growbydata.com/career-overview/");
assert("GrowByData location is Sanepa", growbydata && growbydata.location.includes("Sanepa"));

const yarsatech = companies.find(c => c.id === "yarsatech");
assert("Yarsa Tech & Labs is present in directory", !!yarsatech);
assert("Yarsa Tech careers is /careers/", yarsatech && yarsatech.careersUrl === "https://www.yarsalabs.com/careers/");

const maitri = companies.find(c => c.id === "maitri");
assert("Maitri Services is present in directory", !!maitri);
assert("Maitri careers is LinkedIn jobs", maitri && maitri.careersUrl.includes("linkedin.com/company/maitri-services/jobs"));

const ycotek = companies.find(c => c.id === "ycotek");
assert("Ycotek website is ycotek.com", ycotek && ycotek.website === "https://ycotek.com");
assert("Ycotek careers is /careers-at-yco/", ycotek && ycotek.careersUrl === "https://ycotek.com/careers-at-yco/");

const infinite = companies.find(c => c.id === "infinite");
assert("Infinite website is infinite.com", infinite && infinite.website === "https://www.infinite.com");
assert("Infinite careers is /careers/", infinite && infinite.careersUrl === "https://www.infinite.com/careers/");

const genese = companies.find(c => c.id === "genese");
assert("Genese website is genesesolution.com", genese && genese.website === "https://www.genesesolution.com");
assert("Genese location is Bakhundole", genese && genese.location.includes("Bakhundole"));

const tekvortex = companies.find(c => c.id === "techvortex");
assert("Tekvortex has tekvortex.com website", tekvortex && tekvortex.website === "https://tekvortex.com");

const khalti = companies.find(c => c.id === "khalti");
assert("Khalti is renamed Khalti by IME", khalti && khalti.name === "Khalti by IME");
assert("Khalti location is Panipokhari", khalti && khalti.location.includes("Panipokhari"));

const devfinity = companies.find(c => c.id === "devfinity");
assert("Devfinity is present in directory", !!devfinity);
assert("Devfinity website is devfinity.com", devfinity && devfinity.website.includes("devfinity.com"));

const deltatech = companies.find(c => c.id === "deltatech");
assert("Delta Tech (Biratnagar) is present", !!deltatech);
assert("Delta Tech location is Biratnagar", deltatech && deltatech.location.includes("Biratnagar"));

const tunatech = companies.find(c => c.id === "tunatech");
assert("Tuna Technology (Butwal) is present", !!tunatech);
assert("Tuna Tech location is Butwal", tunatech && tunatech.location.includes("Butwal"));

const nepsavvy = companies.find(c => c.id === "nepsavvy");
assert("Nepsavvy (Chitwan) is present", !!nepsavvy);
assert("Nepsavvy location is Chitwan", nepsavvy && nepsavvy.location.includes("Chitwan"));

// 4. Validate coordinates for all companies
let invalidCoords = 0;
companies.forEach(c => {
  if (!c.coordinates || !Array.isArray(c.coordinates) || c.coordinates.length !== 2) {
    invalidCoords++;
    return;
  }
  const [lat, lng] = c.coordinates;
  // Nepal bounding box roughly 26.0 - 30.5 N, 80.0 - 88.5 E
  if (lat < 26.0 || lat > 30.5 || lng < 80.0 || lng > 88.5) {
    invalidCoords++;
  }
});
assert(`All ${companies.length} companies have valid coordinates within Nepal`, invalidCoords === 0, `${invalidCoords} invalid coordinates`);

// 5. Verify all companies have website, careersUrl, and linkedinUrl
let missingLinks = 0;
companies.forEach(c => {
  if (!c.website || !c.careersUrl || !c.linkedinUrl) {
    missingLinks++;
  }
});
assert(`All ${companies.length} companies have website, careers, and linkedin links`, missingLinks === 0, `${missingLinks} missing links`);

// 6. Verify zero Clearbit URLs exist
const clearbitCount = companies.filter(c => c.logoUrl && c.logoUrl.includes("clearbit.com")).length;
assert("Zero Clearbit URLs in companies.json", clearbitCount === 0, `Found ${clearbitCount} clearbit URLs`);

console.log(`\n${"─".repeat(48)}`);
console.log(`  Passed: ${passed} | Failed: ${failed}`);
console.log(`  Total Companies: ${companies.length}`);
if (failed > 0) process.exit(1);
else console.log("✅ All map, location & links checks passed!\n");
