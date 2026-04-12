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
  {
    label: 'Substack',
    url: 'https://newsletter.pragmaticengineer.com/p/wrapped-the-pragmatic-engineer-in',
  },
  {
    label: 'NYTimes',
    url: 'https://www.nytimes.com/projects/2012/snow-fall/index.html',
  },
  {
    label: 'Personal blog (Simon Willison)',
    url: 'https://simonwillison.net/2023/Aug/27/wordcamp-llms/',
  },
  {
    label: 'GitHub',
    url: 'https://github.com/js-cookie/js-cookie',
  },
  {
    label: 'arXiv',
    url: 'https://arxiv.org/abs/1706.03762',
  },
  {
    label: 'Ars Technica',
    url: 'https://arstechnica.com/features/2005/10/linux/',
  },
  {
    label: 'Stack Overflow',
    url: 'https://stackoverflow.com/questions/11227809/why-is-processing-a-sorted-array-faster-than-processing-an-unsorted-array',
  },
  {
    label: 'The New Yorker',
    url: 'https://www.newyorker.com/magazine/1946/08/31/hiroshima',
  },
  {
    label: 'LinkedIn',
    url: 'https://www.linkedin.com/posts/fagnerbrack_ai-webdev-softwareengineering-activity-7429345910167453696-2MJD?utm_source=share&utm_medium=member_desktop&rcm=ACoAAA5sDgUBEQM_1ZyxJFG0-Bvfm4gOYd-wqo4',
  },
  {
    label: 'X (Twitter)',
    url: 'https://x.com/elonmusk/status/1519480761749016577',
  },
];
