const base = require('../../purgecss.config.base.js');

/** @type {import('purgecss').UserDefinedOptions} */
module.exports = {
  ...base,
  content: [
    ...base.content,
    '../chrome-extension/src/**/*.template.html',
    '../firefox-extension/src/**/*.template.html',
  ],
};
