export function validateVariables(schema, input) {

    const errors = [];
  
    for (const key in schema) {
  
      const field = schema[key];
  
      if (field.required && input[key] === undefined) {
  
        errors.push(`Missing required field: ${key}`);
  
      }
  
    }
  
    return errors;
  
  }