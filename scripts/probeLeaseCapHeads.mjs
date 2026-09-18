/**
 * probeLeaseCapHeads.mjs — D4.28: THE TWO OPEN HEADS, WHERE MEASUREMENT IS SETTLED
 *
 * D4.27 established the order: measurement blocks interaction. Commercial lease
 * and leave-and-licence are the two families where measurement IS settled — the
 * cap reads rent or licence fee, both collected — so their breach and negligence
 * heads can be investigated without dragging a measurement dependency along.
 *
 * The cap carves out fraud, wilful misconduct and liabilities unlimitable by law.
 * The indemnity triggers on breach, negligence and wilful misconduct. One head
 * overlaps and is already coherent. BREACH and NEGLIGENCE are unaddressed, and
 * this probe computes what each treatment would mean rather than arguing it.
 *
 * IT DECIDES NOTHING. Whether a lessee's indemnity for negligence should sit
 * inside a ceiling measured on rent is a question of law, and the arithmetic
 * below is what an advocate should be given rather than a recommendation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lines = [];
const say = (s = "") => { lines.push(s); console.log(s); };
const rs = (n) => "₹" + Math.round(n).toLocaleString("en-IN");

/*
 * A realistic commercial lease. The repository's sampler fills every numeric
 * field with 3, which is fine for checking that a figure reaches the page and
 * useless for checking what the figure MEANS — so the arithmetic below uses
 * ordinary commercial values and says so.
 */
const RENT_PM = 250000;        // monthly rent
const TERM_MONTHS = 60;
const CLAIM = 4000000;         // a third-party claim against the landlord

say("# D4.28 — the breach and negligence heads, where the cap can be computed\n");
say("Commercial lease, rent " + rs(RENT_PM) + "/month over " + TERM_MONTHS + " months.");
say("A visitor is injured through the lessee's negligence and sues the lessor for " + rs(CLAIM) + ".");
say("The lessor claims on the lessee's indemnity. The cap reads \"the total consideration paid");
say("under this Agreement\" — which for a lease is rent paid TO DATE.\n");

/* ── 1. THE FINDING THAT OUTRANKS THE HEADS ──────────────────────────────── */
//
// D4.27 classified these families MEASURABLE, and that verdict is correct and
// insufficient. The quantity is computable, and it is CUMULATIVE — so the
// ceiling is not a number, it is a function of how long the tenancy has run.

say("## The cap is a function of elapsed time, not a figure\n");
say("| month of the term | rent paid to date = the cap | share of a " + rs(CLAIM) + " claim recoverable |");
say("|---|---|---|");
const points = [1, 3, 6, 12, 24, 60];
for (const m of points) {
  const cap = RENT_PM * m;
  const share = Math.min(1, cap / CLAIM);
  say(`| ${m} | ${rs(cap)} | ${(share * 100).toFixed(0)}% |`);
}
const monthFull = Math.ceil(CLAIM / RENT_PM);
say("");
say(`**The same clause recovers ${((RENT_PM / CLAIM) * 100).toFixed(0)}% of the claim in month 1 and 100% from month ${monthFull}.**`);
say("");
say("Nobody chose that. It is an artefact of measuring a ceiling on a CUMULATIVE quantity, and it");
say("means the protection a party has under this clause depends on when the harm happens rather");
say("than on what the parties agreed. A tenancy is at its most exposed in its first months, which");
say("is precisely when this cap is at its smallest.");
say("");
say("**So D4.27's MEASURABLE verdict was necessary and not sufficient.** The measurement layer has");
say("two questions, and only the first was asked:");
say("");
say("```");
say("MEASUREMENT");
say("    ├── computable?    — is there a quantity the formula can read?      (D4.27 asked this)");
say("    └── well-defined?  — is what it computes stable and intended?       (this is new)");
say("```");

/* ── 2. THE TWO HEADS ────────────────────────────────────────────────────── */

const HEADS = [
  {
    head: "BREACH_OF_AGREEMENT",
    inside: "Recovery for breach of covenant is capped at rent paid to date, so an early-term breach is barely compensable.",
    outside: "Breach is fully compensable under Section 73, and the cap governs nothing much — most lease disputes are breaches of covenant.",
    note: "This is the head where INSIDE and OUTSIDE differ most in ordinary practice, because breach is the common case rather than the exceptional one.",
  },
  {
    head: "NEGLIGENCE",
    inside: "A third-party injury claim is recoverable only to the extent of rent paid, and the balance sits with whichever party the claimant chose to sue.",
    outside: "The indemnity answers the claim in full, which is what an indemnity for third-party claims is ordinarily for.",
    note: "The head with the statutory exposure. See the authority below — this is not a free choice between two commercially equivalent readings.",
  },
];

say("\n## The two open heads\n");
for (const h of HEADS) {
  say(`### ${h.head}\n`);
  say(`- **inside the cap** — ${h.inside}`);
  say(`- **outside the cap** — ${h.outside}`);
  say("");
  say(h.note);
  say("");
}

/* ── 3. THE STATUTORY FRAME, STATED CAREFULLY ────────────────────────────── */

say("## The statutory frame, and one thing it is easy to get wrong\n");
say("| source | effect |");
say("|---|---|");
say("| Contract Act **s.23** | an agreement whose object is opposed to public policy is void |");
say("| **Simplex Concrete Piles v Union of India** | a clause barring claims under s.73 is void under s.23 as contrary to public policy |");
say("| **Central Inland Water Transport v Brojo Nath Ganguly** | an unreasonable clause between parties of unequal bargaining power is void under s.23 |");
say("| Contract Act **s.73** | compensation for loss naturally arising — what a cap displaces |");
say("");
say("**THE THING TO GET WRONG.** Secondary sources state that excluding liability for death or");
say("personal injury caused by negligence is \"automatically void\" — and attribute it to COMMON LAW");
say("PRINCIPLES. India has no Unfair Contract Terms Act and no statutory provision to that effect.");
say("The constraint here runs through s.23 public policy and Central Inland Water Transport");
say("unconscionability, which are FACT-SENSITIVE and turn on bargaining power, not through a");
say("bright-line statutory bar.");
say("");
say("Recording it as a bright line would have produced a confident answer resting on the wrong");
say("jurisdiction's statute — which is the same failure as reading a plausible mechanism into");
say("s.146 in D4.25, and it is why the source was read rather than summarised.");
say("");
say("What follows for the NEGLIGENCE head is therefore narrower than \"it cannot be capped\": a cap");
say("on a negligence indemnity is **arguable rather than void**, and its vulnerability rises with");
say("the inequality of the parties and the smallness of the ceiling — which, on the arithmetic");
say("above, is smallest exactly when the tenancy is newest.");

/* ── 4. WHAT IS BEING ASKED ──────────────────────────────────────────────── */

say("\n## The advocate question, stated as narrowly as the evidence allows\n");
say("> For a commercial lease and a leave-and-licence agreement, where the liability ceiling is");
say("> measured on rent or licence fee paid to date: do the BREACH and NEGLIGENCE heads of the");
say("> mutual indemnity sit inside that ceiling, outside it, or inside it subject to a floor?");
say("");
say("Three things are deliberately NOT bundled into that question:");
say("");
say("- the other three heads, which the cap already carves out and which are settled;");
say("- whether the cumulative measure is the right measure at all, which is the measurement");
say("  question this probe has just reopened and which may change the answer;");
say("- how the ceiling applies across more than two principals, which is");
say("  LIABILITY_CAP_APPORTIONMENT and stays open.");

fs.writeFileSync(path.join(ROOT, "docs/audit/LEASE_CAP_HEADS.md"), lines.join("\n") + "\n");
console.log("\nwritten: docs/audit/LEASE_CAP_HEADS.md");
