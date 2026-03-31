function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    if (String(value).trim() === "") continue;
    return value;
  }
  return undefined;
}

function toNumericString(value, fallback = "0") {
  const resolved = firstNonEmpty(value, fallback);
  return String(resolved);
}

function normalizePartyType(name = "", explicitType) {
  const resolvedType = firstNonEmpty(explicitType);
  if (resolvedType) {
    return String(resolvedType);
  }

  const lower = String(name).toLowerCase();
  if (/\bprivate limited\b|\bpvt\.?\s*ltd\b|\blimited\b/.test(lower)) {
    return "Private Limited Company";
  }
  if (/\bllp\b/.test(lower)) {
    return "LLP";
  }
  if (/\bpartnership\b/.test(lower)) {
    return "Partnership Firm";
  }
  return "Individual";
}

function buildPartyDescriptor(name, type, address) {
  const resolvedName = firstNonEmpty(name, "Party");
  const resolvedType = normalizePartyType(resolvedName, type);
  const resolvedAddress = firstNonEmpty(address);

  if (!resolvedAddress) {
    return `${resolvedName}, a ${resolvedType}`;
  }

  if (resolvedType.toLowerCase() === "individual") {
    return `${resolvedName}, an Individual residing at ${resolvedAddress}`;
  }

  return `${resolvedName}, a ${resolvedType} having its address at ${resolvedAddress}`;
}

function derivePurpose(variables = {}) {
  return firstNonEmpty(
    variables.purpose,
    variables.services_description,
    variables.consulting_services,
    variables.business_purpose,
    variables.jv_purpose,
    variables.mou_purpose,
    variables.project_description,
    variables.product_description,
    variables.goods_description,
    variables.property_description,
    variables.security_collateral,
    variables.company_name
      ? `the governance, shareholding rights, and management framework of ${variables.company_name}`
      : undefined,
    variables.partnership_name
      ? `the conduct of the business of ${variables.partnership_name}`
      : undefined,
    variables.jv_name
      ? `the formation and operation of ${variables.jv_name}`
      : undefined,
    variables.loan_amount
      ? `the financial accommodation of INR ${variables.loan_amount} being extended under this Agreement`
      : undefined,
    variables.guaranteed_amount
      ? `the guarantee obligations securing financial accommodation up to INR ${variables.guaranteed_amount}`
      : undefined,
    variables.property_address
      ? `the occupation and lawful use of the premises at ${variables.property_address}`
      : undefined,
    "the lawful business relationship described in this Agreement"
  );
}

function buildDerivedVariables(variables = {}) {
  const party1Name = firstNonEmpty(
    variables.party_1_name,
    variables.employer_name,
    variables.shareholder_1_name,
    variables.partner_1_name,
    variables.company_name
  );
  const party2Name = firstNonEmpty(
    variables.party_2_name,
    variables.employee_name,
    variables.shareholder_2_name,
    variables.partner_2_name,
    variables.guarantor_name
  );
  const party1Address = firstNonEmpty(
    variables.party_1_address,
    variables.employer_address,
    variables.shareholder_1_address,
    variables.partner_1_address,
    variables.company_address
  );
  const party2Address = firstNonEmpty(
    variables.party_2_address,
    variables.employee_address,
    variables.shareholder_2_address,
    variables.partner_2_address,
    variables.guarantor_address
  );
  const party1Type = normalizePartyType(party1Name, variables.party_1_type);
  const party2Type = normalizePartyType(party2Name, variables.party_2_type);
  const guarantorName = firstNonEmpty(variables.guarantor_name);
  const guarantorAddress = firstNonEmpty(variables.guarantor_address);
  const guarantorType = normalizePartyType(
    guarantorName,
    variables.guarantor_type
  );

  return {
    party_1_name: party1Name,
    party_2_name: party2Name,
    party_1_address: party1Address,
    party_2_address: party2Address,
    party_1_type: party1Type,
    party_2_type: party2Type,
    party_1_descriptor: buildPartyDescriptor(party1Name, party1Type, party1Address),
    party_2_descriptor: buildPartyDescriptor(party2Name, party2Type, party2Address),
    guarantor_name: guarantorName,
    guarantor_address: guarantorAddress,
    guarantor_type: guarantorType,
    guarantor_descriptor: buildPartyDescriptor(
      guarantorName,
      guarantorType,
      guarantorAddress
    ),
    purpose: derivePurpose(variables),
    confidentiality_period: firstNonEmpty(
      variables.confidentiality_period,
      "3 years"
    ),
    agreement_term: firstNonEmpty(
      variables.agreement_term,
      variables.contract_duration,
      "2 years"
    ),
    non_compete_period: firstNonEmpty(
      variables.non_compete_period,
      "12 months"
    ),
    occupancy_fee: firstNonEmpty(variables.license_fee, variables.rent_amount),
    occupancy_term: firstNonEmpty(variables.license_term, variables.lease_term),
    permitted_use: firstNonEmpty(
      variables.permitted_use,
      "lawful commercial use"
    ),
    prepayment_premium: toNumericString(variables.prepayment_premium, "0"),
    organisation_address: firstNonEmpty(
      variables.organisation_address,
      variables.company_address,
      variables.party_1_address
    ),
    arbitration_city: firstNonEmpty(variables.arbitration_city, "Mumbai"),
  };
}

function replaceVariableToken(text, key, value) {
  const safeKey = escapeRegex(key);
  const legacyKey = escapeRegex(String(key).toUpperCase());
  const stringValue = String(value);

  let result = text.replace(new RegExp(`{{\\s*${safeKey}\\s*}}`, "g"), stringValue);
  result = result.replace(new RegExp(`\\[\\s*${legacyKey}\\s*\\]`, "g"), stringValue);
  return result;
}

export function injectVariables(text = "", variables = {}) {
  let result = String(text);
  const resolvedVariables = {
    ...buildDerivedVariables(variables),
    ...variables,
  };

  for (const [key, value] of Object.entries(resolvedVariables)) {
    if (value === undefined || value === null) {
      continue;
    }

    result = replaceVariableToken(result, key, value);
  }

  return result;
}
