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
    expectedContent: 'seem to have forgotten the real purpose of software',
  },
  {
    label: 'Medium (friends link)',
    url: 'https://fagnerbrack.com/the-problem-you-solve-is-more-important-than-the-code-you-write-d0e5493132c6?source=friends_link&sk=af337097bd3ecac5750a7fb1dcd0b91d',
    expectedContent: 'seem to have forgotten the real purpose of software',
  },
  {
    label: 'Wikipedia (baseline)',
    url: 'https://en.wikipedia.org/wiki/Reading',
    expectedContent: 'children and adults read because it is enjoyable',
  },
  {
    label: 'Substack',
    url: 'https://newsletter.pragmaticengineer.com/p/wrapped-the-pragmatic-engineer-in',
    expectedContent: 'Some fundamentals will not change',
  },
  {
    label: 'NYTimes',
    url: 'https://www.nytimes.com/projects/2012/snow-fall/index.html',
    expectedContent: 'shaped like a funnel, squeezed the growing swell of churning snow into a steep, twisting gorge',
  },
  {
    label: 'GitHub',
    url: 'https://github.com/js-cookie/js-cookie',
    expectedContent: 'All special characters that are not allowed in the cookie-name or cookie-value',
  },
  {
    label: 'arXiv',
    url: 'https://arxiv.org/abs/1706.03762',
    expectedContent: 'Experiments on two machine translation tasks show these models',
  },
  {
    label: 'Ars Technica',
    url: 'https://arstechnica.com/features/2005/10/linux/',
    expectedContent: 'following is the complete AIM sniffer',
  },
  {
    label: 'Stack Overflow',
    url: 'https://stackoverflow.com/questions/11227809/why-is-processing-a-sorted-array-faster-than-processing-an-unsorted-array',
    expectedContent: 'You are a blind operator of a junction and you hear a train coming',
  },
  {
    label: 'The New Yorker',
    url: 'https://www.newyorker.com/magazine/1946/08/31/hiroshima',
    expectedContent: 'Mr. Matsuo dashed up the front steps into the house and dived among the bedrolls and buried himself there',
  },
  {
    label: 'LinkedIn',
    url: 'https://www.linkedin.com/posts/fagnerbrack_ai-webdev-softwareengineering-activity-7429345910167453696-2MJD?utm_source=share&utm_medium=member_desktop&rcm=ACoAAA5sDgUBEQM_1ZyxJFG0-Bvfm4gOYd-wqo4',
    expectedContent: 'The issue now is that people realised coding was never the bottleneck',
  },
  {
    label: 'X (Twitter)',
    url: 'https://x.com/elonmusk/status/1519480761749016577',
    expectedContent: 'buying Coca-Cola to put the cocaine back in',
  },
];
