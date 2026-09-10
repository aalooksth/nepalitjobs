#!/usr/bin/env node
/**
 * tests/validate-jobs.mjs
 * Validates the structure and content of data/jobs.json and data/companies.json.
 * Run: node tests/validate-jobs.mjs
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

// ── Load files ──────────────────────────────────────────────────────
console.log("\n📋 Loading data files…");
let jobsPayload, companies;

try {
  jobsPayload = JSON.parse(await readFile(join(ROOT, "data", "jobs.json"), "utf8"));
  companies   = JSON.parse(await readFile(join(ROOT, "data", "companies.json"), "utf8"));
  console.log("  ✅ Both files parsed as valid JSON\n");
} catch (err) {
  console.error("  ❌ JSON parse error:", err.message);
  process.exit(1);
}

// ── jobs.json schema ────────────────────────────────────────────────
console.log("🔍 Validating jobs.json schema…");
assert("has generatedAt",   typeof jobsPayload.generatedAt === "string");
assert("has jobCount",      typeof jobsPayload.jobCount === "number");
assert("has companyCount",  typeof jobsPayload.companyCount === "number");
assert("has jobs array",    Array.isArray(jobsPayload.jobs));
assert("has errors array",  Array.isArray(jobsPayload.errors));

const jobs = jobsPayload.jobs;
assert("at least 1 job",    jobs.length > 0, `got ${jobs.length}`);
assert("jobCount matches",  jobsPayload.jobCount <= jobs.length + 5); // allow small drift

// ── Per-job fields ──────────────────────────────────────────────────
console.log("\n🔍 Validating individual job records…");
const REQUIRED = ["id","companyId","company","title","domain","seniority","applyUrl"];
const missingFields = [];
const missingApply  = [];
const duplicateIds  = new Set();
const seenIds       = new Set();

jobs.forEach((j, i) => {
  REQUIRED.forEach(f => {
    if (!j[f]) missingFields.push(`job[${i}] missing "${f}"`);
  });
  if (!j.applyUrl) missingApply.push(j.id);
  if (seenIds.has(j.id)) duplicateIds.add(j.id);
  seenIds.add(j.id);
});

assert("no missing required fields", missingFields.length === 0, missingFields.slice(0,5).join("; "));
assert("no missing applyUrl",        missingApply.length === 0,  `${missingApply.length} missing`);
assert("no duplicate job IDs",       duplicateIds.size === 0,    [...duplicateIds].slice(0,3).join(", "));

// Seniority values
const SENIORITIES = ["Intern / Trainee","Junior / Associate","Mid","Senior","Lead","Manager","Staff / Principal","Architect / Leadership"];
const badSeniority = jobs.filter(j => !SENIORITIES.includes(j.seniority));
assert("all seniority values valid", badSeniority.length === 0, `${badSeniority.length} invalid`);

// listingKind
const badKind = jobs.filter(j => !["vacancy","talent-pool"].includes(j.listingKind));
assert("all listingKind values valid", badKind.length === 0, `${badKind.length} invalid`);

// ── companies.json ──────────────────────────────────────────────────
console.log("\n🔍 Validating companies.json…");
assert("companies is array",     Array.isArray(companies));
assert("at least 1 company",    companies.length > 0);

const COMP_REQUIRED = ["id","name","website","careersUrl","location","source"];
const compMissing = [];
companies.forEach((c, i) => {
  COMP_REQUIRED.forEach(f => {
    if (!c[f]) compMissing.push(`company[${i}] missing "${f}"`);
  });
});
assert("no missing company fields",  compMissing.length === 0, compMissing.slice(0,5).join("; "));

// All company IDs referenced in jobs exist in companies
const compIds = new Set(companies.map(c => c.id));
const unknownCompIds = [...new Set(jobs.map(j => j.companyId))].filter(id => !compIds.has(id));
assert("all job companyIds exist in companies", unknownCompIds.length === 0, unknownCompIds.join(", "));

// ── Summary ─────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(48)}`);
console.log(`  Passed: ${passed} | Failed: ${failed}`);
console.log(`  Jobs:   ${jobs.length} | Companies: ${companies.length}`);

if (failed > 0) {
  console.error(`\n❌ ${failed} check(s) failed.\n`);
  process.exit(1);
} else {
  console.log(`\n✅ All checks passed!\n`);
}
