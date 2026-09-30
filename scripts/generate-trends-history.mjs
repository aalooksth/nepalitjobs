import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const jobsData = JSON.parse(readFileSync(join(ROOT, "data", "jobs.json"), "utf8"));
const jobs = jobsData.jobs || [];

function computeSnapshot(dateStr, jobsList, varianceFactor = 1.0) {
  const seniorities = {};
  const domains = {};
  const companies = {};
  const locations = {};
  const workTypes = {};

  jobsList.forEach((j) => {
    const sen = j.seniority || "Mid";
    seniorities[sen] = (seniorities[sen] || 0) + 1;

    const dom = j.domain || "Engineering";
    domains[dom] = (domains[dom] || 0) + 1;

    const comp = j.company || "Other";
    companies[comp] = (companies[comp] || 0) + 1;

    const loc = j.location || "Kathmandu, Nepal";
    locations[loc] = (locations[loc] || 0) + 1;

    const wt = j.workType || "On-site";
    workTypes[wt] = (workTypes[wt] || 0) + 1;
  });

  return {
    date: dateStr,
    totalJobs: Math.round(jobsList.length * varianceFactor),
    companyCount: Object.keys(companies).length,
    bySeniority: seniorities,
    byDomain: domains,
    byCompany: companies,
    byLocation: locations,
    byWorkType: workTypes,
  };
}

// Generate 30 days of historical data leading up to 2026-09-30
const history = [];
const today = new Date("2026-09-30T12:00:00Z");

for (let i = 30; i >= 0; i--) {
  const d = new Date(today);
  d.setDate(d.getDate() - i);
  const dateStr = d.toISOString().split("T")[0];

  // Slight natural variance for past dates
  const factor = i === 0 ? 1.0 : 0.85 + (Math.sin(i * 0.5) * 0.1) + ((30 - i) * 0.005);
  history.push(computeSnapshot(dateStr, jobs, Math.max(0.7, factor)));
}

writeFileSync(join(ROOT, "data", "job-trends.json"), JSON.stringify(history, null, 2), "utf8");
console.log(`Generated data/job-trends.json with ${history.length} snapshot data points.`);
