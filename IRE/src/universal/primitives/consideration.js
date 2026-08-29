import { expectsAgreementBoilerplate } from "../../../../shared/documentShape.js";

// A notice, an affidavit and a bond are not bargains, so asking them to show
// consideration asks for something they cannot have. The text sniff below is
// kept because it catches instruments that are unilateral in substance whatever
// their registered type; the shape check is the reliable one.
export function evaluateConsideration(facts, documentText = "", documentType = "") {
  const issues = [];
  const text = documentText.toLowerCase();

  // Unilateral instruments legitimately have no monetary consideration
  const isUnilateralDoc = (
    text.includes("last will and testament") ||
    text.includes("will and testament") ||
    text.includes("power of attorney") ||
    text.includes("affidavit") ||
    text.includes("legal notice") ||
    text.includes("vakalatnama") ||
    /\bmou\b/.test(text) ||
    text.includes("memorandum of understanding") ||
    /\bloi\b/.test(text) ||
    text.includes("letter of intent") ||
    text.includes("i hereby") ||
    text.includes("i solemnly") ||
    text.includes("deponent") ||
    text.includes("testator") ||
    text.includes("gift deed")
  );

  if (!facts.hasConsideration && !isUnilateralDoc && expectsAgreementBoilerplate(documentType)) {
    issues.push({
      rule_id: "CONSIDERATION_NOT_DEFINED",
      severity: "HIGH",
      message: "Lawful consideration does not appear to be clearly defined.",
      statutory_reference: "Indian Contract Act 1872 – S.10",
    });
  }

  if (facts.considerationValue === 0) {
    issues.push({
      rule_id: "ZERO_CONSIDERATION_RISK",
      severity: "HIGH",
      message: "Zero or nominal consideration may impact enforceability unless legally justified.",
      statutory_reference: "Indian Contract Act 1872 – S.25",
    });
  }

  if (text.includes("at sole discretion") && text.includes("payment")) {
    issues.push({
      rule_id: "ILLUSORY_CONSIDERATION",
      severity: "HIGH",
      message: "Payment terms appear discretionary and may be treated as illusory consideration.",
      statutory_reference: "Indian Contract Act 1872 – S.10",
    });
  }

  return issues;
}
