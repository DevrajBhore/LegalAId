export function inferDomainRequirements(documentType) {

    const requirements = [];
  
    const type = documentType.toLowerCase();
  
    if (type.includes("lease")) {
      requirements.push("PROPERTY");
    }
  
    if (type.includes("employment")) {
      requirements.push("PAYMENT");
    }
  
    if (type.includes("nda")) {
      requirements.push("CONFIDENTIALITY");
    }
  
    return requirements;
  }