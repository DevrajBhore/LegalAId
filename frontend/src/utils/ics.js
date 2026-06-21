// Builds an iCalendar (.ics) file from a document's obligations so the key dates
// (registration deadline, notice cut-off, expiry, recurring rent…) land in the
// user's calendar with reminders — entirely client-side, no backend round-trip.

function pad(n) {
  return String(n).padStart(2, "0");
}

// All-day event date (YYYYMMDD) from an ISO date string.
function icsDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

function stamp() {
  const d = new Date();
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(
    d.getUTCHours()
  )}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function escapeText(s) {
  return String(s || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function nextDay(yyyymmdd) {
  const y = +yyyymmdd.slice(0, 4);
  const m = +yyyymmdd.slice(4, 6) - 1;
  const d = +yyyymmdd.slice(6, 8);
  const next = new Date(Date.UTC(y, m, d + 1));
  return `${next.getUTCFullYear()}${pad(next.getUTCMonth() + 1)}${pad(next.getUTCDate())}`;
}

export function buildICS(obligations = [], docTitle = "Agreement") {
  const dated = obligations.filter((o) => o.due_date && icsDate(o.due_date));
  const dtstamp = stamp();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LegalAId//Obligations//EN",
    "CALSCALE:GREGORIAN",
  ];
  dated.forEach((o, i) => {
    const start = icsDate(o.due_date);
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:legalaid-${dtstamp}-${i}@legal-aid.xyz`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART;VALUE=DATE:${start}`);
    lines.push(`DTEND;VALUE=DATE:${nextDay(start)}`);
    if (o.recurrence === "monthly") lines.push("RRULE:FREQ=MONTHLY");
    lines.push(`SUMMARY:${escapeText(`${docTitle}: ${o.title}`)}`);
    lines.push(`DESCRIPTION:${escapeText(o.description)}`);
    // A reminder 7 days before (or same-day for recurring).
    lines.push("BEGIN:VALARM");
    lines.push("ACTION:DISPLAY");
    lines.push(`DESCRIPTION:${escapeText(o.title)}`);
    lines.push(`TRIGGER:-P${o.recurrence ? "0" : "7"}D`);
    lines.push("END:VALARM");
    lines.push("END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadICS(obligations, docTitle) {
  const ics = buildICS(obligations, docTitle);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${String(docTitle || "agreement").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-key-dates.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
