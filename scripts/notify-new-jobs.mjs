import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const RECIPIENT = process.env.EMAIL_RECEIVER || "hello@aloks.com.np";
const SENDER = process.env.EMAIL_SENDER || "Nepal IT Jobs Alerts <alerts@aloks.com.np>";

export async function checkAndSendNewJobsNotification(oldJobsList = [], newJobsList = [], options = {}) {
  const oldIds = new Set((oldJobsList || []).map((j) => j.id));
  const newlyAdded = (newJobsList || []).filter((j) => !oldIds.has(j.id));

  console.log(`\n📧 Email Notification Check: ${newlyAdded.length} newly added job(s) detected.`);

  if (newlyAdded.length === 0 && !options.force) {
    console.log("No new jobs to notify.");
    return { sent: false, count: 0 };
  }

  const jobsToNotify = newlyAdded.length > 0 ? newlyAdded : newJobsList.slice(0, 5); // Fallback for preview
  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const subject = `🚀 Nepal IT Jobs Alert: ${jobsToNotify.length} New Tech Vacancies (${dateStr})`;

  const jobItemsHtml = jobsToNotify.map((j, idx) => `
    <div style="background:#1e2334; border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:18px; margin-bottom:14px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
        <div>
          <span style="font-size:0.75rem; color:#8c95b0; font-weight:600; text-transform:uppercase;">${j.company}</span>
          <h3 style="font-size:1.1rem; margin:4px 0 8px; color:#edf0f7; font-family:'Outfit',sans-serif;">${j.title}</h3>
        </div>
        <span style="font-size:0.7rem; font-weight:700; background:rgba(124,58,237,0.15); color:#a78bfa; padding:3px 10px; border-radius:20px; border:1px solid rgba(124,58,237,0.3); white-space:nowrap;">
          ${j.seniority || 'Mid'}
        </span>
      </div>
      <div style="font-size:0.82rem; color:#8c95b0; margin-bottom:12px;">
        📍 <strong>${j.location || 'Nepal'}</strong> · 💼 <strong>${j.employmentType || 'Full-time'}</strong> (${j.workType || 'On-site'})
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px;">
        ${(j.techStack || []).map(t => `<span style="font-size:0.7rem; background:#12151e; color:#edf0f7; padding:2px 8px; border-radius:12px; border:1px solid rgba(255,255,255,0.06);">${t}</span>`).join('')}
      </div>
      <div style="display:flex; gap:10px;">
        <a href="${j.applyUrl}" target="_blank" style="background:linear-gradient(135deg, #dc2646, #7c3aed); color:#ffffff; padding:8px 18px; border-radius:20px; text-decoration:none; font-size:0.82rem; font-weight:700; display:inline-block;">
          Apply Direct &rarr;
        </a>
        <a href="${j.applyUrl}?ref=aloks.com.np" target="_blank" style="background:#252c40; color:#a78bfa; padding:8px 16px; border-radius:20px; text-decoration:none; font-size:0.82rem; font-weight:600; border:1px solid rgba(124,58,237,0.3); display:inline-block;">
          Referral Apply
        </a>
      </div>
    </div>
  `).join('');

  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <title>${subject}</title>
  </head>
  <body style="background:#0c0e14; color:#edf0f7; font-family:'Inter',-apple-system,sans-serif; margin:0; padding:32px 16px;">
    <div style="max-width:640px; margin:0 auto; background:#12151e; border:1px solid rgba(255,255,255,0.08); border-radius:16px; overflow:hidden; padding:28px;">
      
      <!-- Header -->
      <div style="text-align:center; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:20px; margin-bottom:24px;">
        <span style="font-size:1.4rem;">🇳🇵</span>
        <h1 style="font-size:1.4rem; color:#edf0f7; margin:6px 0 4px; font-family:'Outfit',sans-serif;">Nepal IT Jobs — Daily Digest</h1>
        <p style="font-size:0.85rem; color:#8c95b0; margin:0;">${jobsToNotify.length} newly aggregated vacancies across Nepal tech hubs</p>
      </div>

      <!-- Job items -->
      ${jobItemsHtml}

      <!-- Footer -->
      <div style="border-top:1px solid rgba(255,255,255,0.08); padding-top:20px; margin-top:28px; text-align:center; font-size:0.78rem; color:#565f78; line-height:1.6;">
        <p style="margin:0 0 6px;">Live IT job vacancies from Nepal's top tech companies.</p>
        <p style="margin:0;">Made with ❤️ in 🇳🇵 by <a href="https://aloks.com.np" style="color:#f04068; text-decoration:none;">Alok</a> — <a href="mailto:hello@aloks.com.np" style="color:#a78bfa; text-decoration:none;">hello@aloks.com.np</a></p>
      </div>
    </div>
  </body>
  </html>
  `;

  // Save to scratch for preview & audit trail
  const scratchDir = join(ROOT, "scratch");
  if (!existsSync(scratchDir)) {
    try { await import("fs/promises").then(fs => fs.mkdir(scratchDir, { recursive: true })); } catch {}
  }
  writeFileSync(join(scratchDir, "latest-jobs-digest.html"), htmlContent, "utf8");
  console.log(`Saved email digest preview to scratch/latest-jobs-digest.html`);

  // Dispatch via Resend API if API Key is present
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: SENDER,
          to: [RECIPIENT],
          subject,
          html: htmlContent,
        }),
      });
      const data = await res.json();
      console.log(`✅ Resend Email dispatched successfully! ID: ${data.id || JSON.stringify(data)}`);
      return { sent: true, provider: "Resend", id: data.id, count: jobsToNotify.length };
    } catch (err) {
      console.error(`❌ Resend API error:`, err.message);
    }
  } else {
    console.log(`ℹ️ RESEND_API_KEY not set. Email digest compiled and saved to scratch/latest-jobs-digest.html.`);
  }

  return { sent: false, provider: "preview-only", count: jobsToNotify.length, html: htmlContent };
}

// Allow direct CLI execution: node scripts/notify-new-jobs.mjs --preview
if (process.argv[1]?.endsWith("notify-new-jobs.mjs")) {
  const jobsData = JSON.parse(readFileSync(join(ROOT, "data", "jobs.json"), "utf8"));
  checkAndSendNewJobsNotification([], jobsData.jobs, { force: true }).then(() => {
    console.log("Notification preview generation complete.");
  });
}
