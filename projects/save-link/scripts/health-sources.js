/**
 * Labelled source list exercised by scripts/check-sources.js.
 *
 * Keep the list diverse — one entry per edge-sniffing vendor we care about.
 * Failures surface the `label` in the GitHub Actions UI, not a URL.
 */
exports.HEALTH_SOURCES = [
  {
    label: 'Medium (custom domain)',
    url: 'https://fagnerbrack.com/the-problem-you-solve-is-more-important-than-the-code-you-write-d0e5493132c6',
  },
  {
    label: 'Medium (friends link)',
    url: 'https://fagnerbrack.com/the-problem-you-solve-is-more-important-than-the-code-you-write-d0e5493132c6?source=friends_link&sk=af337097bd3ecac5750a7fb1dcd0b91d',
  },
  {
    label: 'Wikipedia (baseline)',
    url: 'https://en.wikipedia.org/wiki/Reading',
  },
  // TODO add more sources — keep each one from a different edge sniffer vendor:
  // { label: 'Medium (medium.com)', url: '<fill with a public medium.com article>' },
  // { label: 'Substack',            url: '<fill with a known Substack post>' },
  // { label: 'Dev.to',               url: '<fill with a known dev.to post>' },
];
