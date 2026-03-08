import assert from 'node:assert';

// V8 coverage: Use const + arrow function to avoid function declaration coverage quirks - see https://github.com/jestjs/jest/issues/11188
export const requireEnv = (name: string, defaultValue?: string): string => {
  const value = process.env[name];
  // Single-line conditional for accurate V8 coverage - see https://github.com/jestjs/jest/issues/11188
  if ((value === undefined || value === '') && defaultValue !== undefined) return defaultValue;
  assert.ok(value !== undefined && value !== '', `Environment variable ${name} is required but not set`);
  return value;
};

export const getEnv = (name: string): string | undefined => {
  const value = process.env[name];
  // Single-line return for accurate V8 coverage - see https://github.com/jestjs/jest/issues/11188
  return (value === undefined || value === '') ? undefined : value;
};
