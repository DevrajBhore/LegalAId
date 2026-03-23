export function injectVariables(text = "", variables = {}) {

  let result = String(text);

  for (const key in variables) {

    const value = variables[key];

    if (value === undefined || value === null) {
      continue;
    }

    const pattern = new RegExp(`{{\\s*${key}\\s*}}`, "g");

    result = result.replace(pattern, String(value));

  }

  return result;

}