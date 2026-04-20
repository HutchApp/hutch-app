/** @type {import('purgecss').UserDefinedOptions} */
module.exports = {
  css: ['src/**/*.styles.css'],
  content: [
    'src/**/*.template.ts',
    'src/**/*.template.html',
    'src/**/*.component.ts',
    'src/**/*.styles.ts',
    'src/**/*.client.js',
    'src/**/*.client.ts',
  ],
  safelist: { standard: [], deep: [], greedy: [] },
  rejected: true,
  output: false,
};
