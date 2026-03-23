import Ajv from "ajv";

const ajv = new Ajv({ allErrors: true });

export function buildSchemaValidator(schema) {
  const validate = ajv.compile(schema);

  return function validateClause(clause) {
    const valid = validate(clause);
    if (!valid) {
      const errors = validate.errors.map(e => {
        const path = e.instancePath || "(root)";
        return `${path} ${e.message}`;
      });
      throw new Error(
        `Clause schema validation failed for ${clause.clause_id}:\n` +
        errors.join("\n")
      );
    }
    return true;
  };
}
