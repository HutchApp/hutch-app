/** @type {import('purgecss').UserDefinedOptions} */
module.exports = {
  css: ['src/web/**/*.styles.css'],
  content: [
    'src/**/*.template.ts',
    'src/**/*.component.ts',
    'src/web/base.styles.ts',
    'src/**/*.client.js',
  ],
  safelist: {
    standard: [],
    deep: [],
    greedy: [],
  },
  rejected: true,
  output: false,
};
