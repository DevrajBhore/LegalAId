/**
 * ruleCompiler.js — Universal Statutory Rule Compiler
 *
 * Reads real section JSON files from your 804-act IndiaCode KB.
 * Classifies each section into a rule type and builds an actionable
 * check() function that actually fires against draft text.
 *
 * RULE TYPES:
 *   VOID_CLAUSE        — section declares something void/invalid
 *   PROHIBITION        — section says something SHALL NOT be done
 *   NUMERIC_THRESHOLD  — section specifies a minimum number (days/months)
 *   REGISTRATION       — section requires document registration
 *   STAMP_DUTY         — section requires stamping
 *   MANDATORY          — section says something SHALL be included
 *   FORMATION          — section specifies contract formation requirements
 */

// ── Word to number conversion ─────────────────────────────────────────────────
const WORD_NUMBERS = {
  one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8,
  nine:9, ten:10, eleven:11, twelve:12, thirteen:13, fourteen:14,
  fifteen:15, sixteen:16, seventeen:17, eighteen:18, nineteen:19,
  twenty:20, thirty:30, forty:40, fifty:50, sixty:60, ninety:90,
};
function wordToNumber(word) {
  return WORD_NUMBERS[(word || "").toLowerCase()] || null;
}

// ── Semantic classifiers ──────────────────────────────────────────────────────

const CLASSIFIERS = [

  // ── VOID_CLAUSE ──────────────────────────────────────────────────────────
  {
    type    : "VOID_CLAUSE",
    severity: "HIGH",
    test    : (s) => {
      const c = s.content;
      return (
        /\b(is|shall be|are|be)\s+(void|voidable|invalid|illegal|unenforceable)\b/i.test(c) &&
        !/^this act may be called/i.test(c.trim()) &&
        s.section_number !== "1"
      );
    },
    extract : (s) => {
      // Extract the TRIGGER CONDITION — what makes it void
      const c = s.content;

      // Pattern: "Every agreement [condition] is void"
      let m = c.match(/every\s+agreement\s+([^,\.]{10,100})\s+is\s+void/i);
      if (m) return { trigger: m[1].trim(), void_consequence: true };

      // Pattern: "[Subject] is void"
      m = c.match(/([^\.]{15,100})\s+(?:is|shall be|are)\s+(?:void|invalid|unenforceable)/i);
      if (m) return { trigger: m[1].trim().slice(-80), void_consequence: true };

      return { trigger: null, void_consequence: true };
    },
    buildCheck: (section, extracted) => {
      const c = section.content;
      const secNum = String(section.section_number);

      // ── ICA S.25: Agreements without consideration are void ──────────────
      if (secNum === "25" && /without consideration/i.test(c)) {
        return (text) => {
          // Only flag if explicitly "no consideration" or "nil consideration"
          return !/without\s+consideration|nil\s+consideration|no\s+consideration\s+is\s+paid/i.test(text);
        };
      }

      // ── ICA S.26: Restraint of marriage is void ──────────────────────────
      if (secNum === "26" && /restraint.*marriage/i.test(c)) {
        return (text) => !/restraint.*marriage|shall\s+not\s+marry|prohibited.*from.*marr/i.test(text);
      }

      // ── ICA S.28: Ouster of courts is void ──────────────────────────────
      if (secNum === "28" && /restricted\s+absolutely.*enforcing/i.test(c)) {
        return (text) => !/no\s+(court|party|person)\s+shall\s+(have\s+jurisdiction|bring\s+any\s+suit|file|commence)|absolutely\s+(bar|prohibit|restrict).*court|ouster\s+of\s+jurisdiction/i.test(text);
      }

      // ── ICA S.29: Uncertain agreements are void ──────────────────────────
      if (secNum === "29" && /meaning.*not\s+certain/i.test(c)) {
        return (text) => {
          // Flag if scope is not certain — but this is too broad, keep as informational
          return true;
        };
      }

      // ── ICA S.30: Wagering agreements are void ───────────────────────────
      if (secNum === "30" && /wager/i.test(c)) {
        return (text) => !/agreement.*wager|wagering\s+agreement|bet\s+on|gambling\s+contract/i.test(text);
      }

      // ── ICA S.56: Impossible agreements are void ─────────────────────────
      if (secNum === "56" && /impossible\s+in\s+itself/i.test(c)) {
        return (text) => !/impossible.*in\s+itself|physically\s+impossible|legally\s+impossible\s+to\s+perform/i.test(text);
      }

      // ── ICA S.23: Unlawful object/consideration ──────────────────────────
      if (secNum === "23" && /unlawful|forbidden\s+by\s+law/i.test(c)) {
        return (text) => {
          // Flag if document explicitly states an unlawful object
          const hasUnlawful = /unlawful\s+purpose|illegal\s+object|forbidden\s+by\s+law|against\s+public\s+policy\s+of\s+india/i.test(text);
          return !hasUnlawful;
        };
      }

      // ── TPA S.10: Absolute restraint on alienation is void ───────────────
      if (secNum === "10" && /restraining.*transferee.*parting/i.test(c)) {
        return (text) => !/absolutely\s+restrain.*transfer|shall\s+never\s+transfer|prohibited\s+from\s+(ever\s+)?selling|cannot\s+transfer\s+for\s+life/i.test(text);
      }

      // ── TPA S.53: Fraudulent transfer is voidable ────────────────────────
      if (secNum === "53" && /fraudulent.*transfer/i.test(c)) {
        return (text) => !/fraudulent\s+transfer|transfer.*defeat.*creditor|transfer.*defraud/i.test(text);
      }

      // ── TPA S.124/125/126: Gift deed specific rules ──────────────────────
      if (secNum === "124" && /future\s+property/i.test(c)) {
        return (text) => !/gift.*future\s+property|donor.*future\s+assets/i.test(text);
      }

      // ── ID Act S.24: Illegal strike ───────────────────────────────────────
      if (secNum === "24" && /strike.*illegal/i.test(c)) {
        return (text) => !/engage\s+in\s+strike|instigate.*strike|illegal\s+strike/i.test(text);
      }

      // Default: informational — don't flag unless trigger keywords found
      if (extracted.trigger) {
        // Build a simple keyword check from the trigger
        const keywords = extracted.trigger
          .toLowerCase()
          .replace(/[^a-z\s]/g, ' ')
          .split(/\s+/)
          .filter(w => w.length > 5 && !STOP_WORDS.has(w))
          .slice(0, 2);

        if (keywords.length >= 2) {
          return (text) => {
            // Only flag if ALL trigger keywords appear (suggests this section is relevant)
            const allMatch = keywords.every(kw => text.includes(kw));
            // Always return true (pass) for generic void clauses — too risky to auto-flag
            return true;
          };
        }
      }

      return (_text) => true; // Informational — no auto-flag
    },
  },

  // ── PROHIBITION ──────────────────────────────────────────────────────────
  {
    type    : "PROHIBITION",
    severity: "HIGH",
    test    : (s) => {
      const c = s.content;
      return (
        /no\s+(person|party|employer|employee|company|court|authority|workman)\s+shall\b/i.test(c) &&
        s.section_number !== "1" &&
        !/^this act/i.test(c.trim())
      );
    },
    extract : (s) => {
      const m = s.content.match(
        /no\s+(?:person|party|employer|employee|company|court|authority|workman)\s+shall\s+([^\.]{10,120})/i
      );
      return { prohibition: m ? m[1].trim() : null };
    },
    buildCheck: (section, extracted) => {
      const secNum = String(section.section_number);
      const c = section.content;

      // ── Child labour prohibitions ─────────────────────────────────────────
      if (/child.*employ|employ.*child|below.*age.*14|under.*14\s*years/i.test(c)) {
        return (text) => !/employ\s*(children|child|minor)\s*(below|under)\s*14|child\s*labour/i.test(text);
      }

      // Too risky to auto-flag general prohibitions without context
      return (_text) => true;
    },
  },

  // ── NUMERIC_THRESHOLD ────────────────────────────────────────────────────
  {
    type    : "NUMERIC_THRESHOLD",
    severity: "HIGH",
    test    : (s) => {
      const c = s.content;
      return (
        /not\s+less\s+than\s+\d+\s*(days?|months?|years?)/i.test(c) ||
        /\b\d+\s*days?['']?\s*(?:written\s+|prior\s+|clear\s+)?(?:notice|period)/i.test(c) ||
        /at\s+least\s+\d+\s*(days?|months?)/i.test(c) ||
        /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|sixty|ninety)\s+(days?['']?|months?['']?)\s*(?:written\s+|prior\s+|clear\s+)?(?:notice|period)/i.test(c)
      ) && s.section_number !== "1";
    },
    extract : (s) => {
      const c = s.content;
      const all = [];

      // Digit: not less than X days/months
      for (const m of c.matchAll(/not\s+less\s+than\s+(\d+)\s*(days?|months?|years?)/gi)) {
        const u = m[2].replace(/s$/,'').toLowerCase();
        const d = u==='month'?parseInt(m[1])*30:u==='year'?parseInt(m[1])*365:parseInt(m[1]);
        all.push({ threshold: parseInt(m[1]), unit: u, days: d });
      }

      // Digit: X days notice
      for (const m of c.matchAll(/\b(\d+)\s*days?['']?\s*(?:written\s+|prior\s+|clear\s+)?(?:notice|period)/gi)) {
        all.push({ threshold: parseInt(m[1]), unit: 'day', days: parseInt(m[1]) });
      }

      // Word: fifteen days' notice
      const WN_PAT = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|sixty|ninety)\s+(days?['']?|months?['']?)\s*(?:written\s+|prior\s+|clear\s+)?(?:notice|period)/gi;
      for (const m of c.matchAll(WN_PAT)) {
        const n = wordToNumber(m[1]);
        if (!n) continue;
        const u = m[2].replace(/s?['']?$/,'').toLowerCase();
        const d = u === 'month' ? n * 30 : n;
        all.push({ threshold: n, unit: u, days: d });
      }

      if (!all.length) return null;
      all.sort((a, b) => a.days - b.days);
      return all[0];
    },
    buildCheck: (_section, extracted) => {
      if (!extracted || !extracted.threshold) return null;
      const threshold = extracted.threshold;
      const unit = extracted.unit;

      return (text) => {
        const isRelevant = /(notice|terminat)/i.test(text);
        if (!isRelevant) return true;

        const patterns = [
          /(\d+)\s*(?:days?|months?)['']?[^.]{0,25}(?:written\s+|prior\s+|clear\s+)?notice/i,
          /(\d+)\s*(?:written\s+|prior\s+|clear\s+)?days?\s+notice/i,
          /notice\s+of\s+(\d+)\s*days?/i,
        ];

        let value = null;
        let foundUnit = unit;
        for (const p of patterns) {
          const m = text.match(p);
          if (m) {
            value = parseInt(m[1]);
            if (/month/i.test(m[0])) foundUnit = 'month';
            break;
          }
        }
        if (value === null) return true;

        let valueDays  = foundUnit === 'month' ? value * 30 : value;
        let threshDays = unit     === 'month' ? threshold * 30 : threshold;

        return valueDays >= threshDays;
      };
    },
  },

  // ── REGISTRATION ─────────────────────────────────────────────────────────
  {
    type    : "REGISTRATION",
    severity: "HIGH",
    test    : (s) => {
      const c = s.content;
      return (
        /shall\s+be\s+register(ed|ation)/i.test(c) ||
        /the\s+following\s+documents\s+shall\s+be\s+register/i.test(c)
      ) && s.section_number !== "1";
    },
    extract : (s) => {
      const m = s.content.match(/the\s+following\s+documents?\s+shall\s+be\s+register[^.]{0,200}/i);
      return { requirement: m ? m[0].trim().slice(0, 150) : "Registration required" };
    },
    buildCheck: (section, _extracted) => {
      const c = section.content;
      return (text) => {
        const isPropertyDoc = /immovable\s+property|sale\s+deed|mortgage|transfer\s+of\s+property/i.test(text);
        if (!isPropertyDoc) return true;
        return /register(ed|ation)|sub.?registrar/i.test(text);
      };
    },
  },

  // ── STAMP_DUTY ───────────────────────────────────────────────────────────
  {
    type    : "STAMP_DUTY",
    severity: "MEDIUM",
    test    : (s) => {
      const c = s.content;
      return (
        /duly\s+stamp(ed)?|chargeable\s+with\s+(stamp\s+)?duty/i.test(c) ||
        /no\s+instrument.*shall\s+be\s+admitted/i.test(c)
      ) && s.section_number !== "1";
    },
    extract : (_s) => ({ requirement: "Document must be duly stamped" }),
    buildCheck: (_section, _extracted) => {
      return (text) => /stamp\s+duty|non.?judicial\s+stamp|stamp\s+paper|duly\s+stamp/i.test(text);
    },
  },

  // ── MANDATORY ────────────────────────────────────────────────────────────
  {
    type    : "MANDATORY",
    severity: "MEDIUM",
    test    : (s) => {
      const c = s.content;
      return (
        /every\s+(contract|agreement|instrument|document|employer|company)\s+shall\b/i.test(c) ||
        /shall\s+(contain|include|specify|state)\b/i.test(c)
      ) && s.section_number !== "1" &&
      !/shall\s+be\s+published|shall\s+submit\s+a\s+report/i.test(c);
    },
    extract : (s) => {
      const m = s.content.match(
        /(?:every\s+\w+\s+shall|shall\s+(?:contain|include|specify|state))\s+([^.]{10,100})/i
      );
      return { obligation: m ? m[1].trim() : null };
    },
    buildCheck: (_section, _extracted) => (_text) => true, // informational
  },

  // ── FORMATION ────────────────────────────────────────────────────────────
  {
    type    : "FORMATION",
    severity: "MEDIUM",
    test    : (s) => {
      return (
        /free\s+consent|lawful\s+(object|consideration)|competent\s+to\s+contract/i.test(s.content) &&
        !/^this act/i.test(s.content.trim())
      );
    },
    extract : (_s) => ({ requirement: "Contract formation requirements" }),
    buildCheck: (_section, _extracted) => (_text) => true, // covered by illegalClauseValidator
  },

];

// ── Domain signals ────────────────────────────────────────────────────────────

const DOMAIN_SIGNALS = [
  { domain: "PROPERTY",   pattern: /\bleas(e|or|ee)|immovable\s+property|rent|premises\b/i },
  { domain: "EMPLOYMENT", pattern: /\bemploye(r|e)|workman|retrench|salary|wage|labour\b/i },
  { domain: "CORPORATE",  pattern: /\bcompan(y|ies)|director|shareholder|board\s+of\b/i },
  { domain: "FINANCE",    pattern: /\bloan|mortgage|pledge|interest\s+rate|repay\b/i },
  { domain: "IP",         pattern: /\bcopyright|patent|trademark|intellectual\s+property\b/i },
  { domain: "CONTRACT",   pattern: /\bagreement|contract|consent|consideration\b/i },
];

// ── Classify a section ────────────────────────────────────────────────────────

function classifySection(section, actTitle) {
  const content = section.content || "";
  if (content.trim().length < 30) return null;

  for (const classifier of CLASSIFIERS) {
    if (!classifier.test(section)) continue;

    const extracted = classifier.extract(section);
    if (!extracted) continue;

    const checkFn = classifier.buildCheck(section, extracted);
    if (!checkFn) continue;

    const description = buildDescription(section, actTitle, classifier.type, extracted);
    if (!description) continue;

    const failMsg = buildFailMessage(section, actTitle, classifier.type, extracted);
    if (!failMsg) continue;

    const inferredDomains = DOMAIN_SIGNALS
      .filter(d => d.pattern.test(content))
      .map(d => d.domain);

    return {
      rule_id    : `${sanitizeId(actTitle)}_S${section.section_number}_${classifier.type}`,
      act        : actTitle,
      section    : section.section_number,
      rule_type  : classifier.type,
      severity   : classifier.severity,
      description,
      domains    : inferredDomains,
      check      : checkFn,
      fail_message: failMsg,
      source_section: section.section_id,
    };
  }

  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDescription(section, actTitle, ruleType, extracted) {
  const s = section.section_number;
  const short = actTitle.replace(/^The\s+/i,"").replace(/,\s*\d{4}$/,"");
  switch (ruleType) {
    case "VOID_CLAUSE":     return `${short} S.${s}: Certain conditions render the agreement void.`;
    case "PROHIBITION":     return extracted.prohibition ? `${short} S.${s}: Prohibits — "${extracted.prohibition.slice(0,80)}"` : `${short} S.${s}: Contains a prohibition.`;
    case "NUMERIC_THRESHOLD": return extracted ? `${short} S.${s}: Minimum ${extracted.threshold} ${extracted.unit}(s) required.` : null;
    case "REGISTRATION":    return `${short} S.${s}: Document must be registered.`;
    case "STAMP_DUTY":      return `${short} S.${s}: Document must be duly stamped.`;
    case "MANDATORY":       return `${short} S.${s}: Contains a mandatory obligation.`;
    case "FORMATION":       return `${short} S.${s}: Contract formation requirements.`;
    default: return null;
  }
}

function buildFailMessage(section, actTitle, ruleType, extracted) {
  const ref = `${actTitle} – S.${section.section_number}`;
  switch (ruleType) {
    case "VOID_CLAUSE":        return `Clause may render agreement void — ${ref}.`;
    case "PROHIBITION":        return extracted.prohibition ? `Prohibited: "${extracted.prohibition.slice(0,80)}" — ${ref}.` : null;
    case "NUMERIC_THRESHOLD":  return extracted ? `Minimum ${extracted.threshold} ${extracted.unit}(s) required — ${ref}.` : null;
    case "REGISTRATION":       return `Document must be registered — ${ref}.`;
    case "STAMP_DUTY":         return `Document must be duly stamped — ${ref}.`;
    case "MANDATORY":          return null; // informational only
    case "FORMATION":          return null; // informational only
    default: return null;
  }
}

/**
 * Compile rules from a single act and its sections.
 * Called by statutoryEngine for each loaded act.
 */
export function compileRulesFromAct(actJSON, sections) {

  if (!actJSON || !Array.isArray(sections) || sections.length === 0) return [];

  const actTitle = actJSON.title || actJSON.act_id || "Unknown Act";
  const rules = [];

  for (const section of sections) {
    if (["1","2","3"].includes(String(section.section_number))) continue;
    if ((section.content || "").length < 50) continue;

    const rule = classifySection(section, actTitle);
    if (rule) rules.push(rule);
  }

  // Dedup: one STAMP_DUTY and one REGISTRATION per act
  const deduped = [];
  const seenActType = new Set();
  const PREF_STAMP = ["17","35","3"];
  const PREF_REG   = ["17","49"];

  for (const rule of rules) {
    const key = `${rule.section}_${rule.rule_type}`;

    if (rule.rule_type === "STAMP_DUTY") {
      if (seenActType.has("STAMP_DUTY")) continue;
      const isPref = PREF_STAMP.includes(String(rule.section));
      if (!isPref && rules.some(r => r.rule_type === "STAMP_DUTY" && PREF_STAMP.includes(String(r.section)))) continue;
      seenActType.add("STAMP_DUTY");
    }

    if (rule.rule_type === "REGISTRATION") {
      if (seenActType.has("REGISTRATION")) continue;
      const isPref = PREF_REG.includes(String(rule.section));
      if (!isPref && rules.some(r => r.rule_type === "REGISTRATION" && PREF_REG.includes(String(r.section)))) continue;
      seenActType.add("REGISTRATION");
    }

    if (seenActType.has(key)) continue;
    seenActType.add(key);
    deduped.push(rule);
  }

  return deduped;
}

const STOP_WORDS = new Set([
  'shall','have','been','which','where','their','there','under',
  'such','every','other','than','that','this','with','from',
  'into','upon','about','above','after','against','before',
  'between','during','except','through','without',
]);

function sanitizeId(actTitle) {
  return actTitle
    .replace(/^The\s+/i,'')
    .replace(/[^a-zA-Z0-9]/g,'_')
    .replace(/_+/g,'_')
    .replace(/^_|_$/g,'')
    .toUpperCase()
    .slice(0,30);
}
