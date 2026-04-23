/**
 * Labelled source list exercised by scripts/check-sources.js.
 *
 * Keep the list diverse — one entry per edge-sniffing vendor we care about.
 * Failures surface the `label` in the GitHub Actions UI, not a URL.
 *
 * A canary failure is a real failure: the crawler must handle TLS-fingerprint
 * blocks (e.g. Stack Overflow via Cloudflare) so production traffic still
 * reaches the origin. Fix the crawler before touching this list.
 *
 * `expectsThumbnail` asserts the thumbnail download path: `true` means the
 * source has an og:image/twitter:image that must fetch successfully under
 * the same H2-fallback path as the article HTML, `false` means the source
 * legitimately has no thumbnail (e.g. X/Twitter via oembed returns synthetic
 * HTML with no meta tags).
 */
exports.HEALTH_SOURCES = [
  {
    label: 'Medium (custom domain)',
    url: 'https://fagnerbrack.com/the-problem-you-solve-is-more-important-than-the-code-you-write-d0e5493132c6',
    expectedContent: 'seem to have forgotten the real purpose of software',
    expectsThumbnail: true,
  },
  {
    // Medium publications (e.g. itnext.io) serve an incomplete TLS chain —
    // leaf cert without the Sectigo intermediate. Node's fetch fails with
    // UNABLE_TO_VERIFY_LEAF_SIGNATURE. AIA chasing (aia-fetch.ts) recovers
    // by fetching the intermediate from the leaf cert's AIA URL.
    label: 'Medium (itnext publication)',
    url: 'https://itnext.io/youre-not-praised-for-the-bugs-you-didn-t-create-ef3df6894d5c',
    expectedContent: 'developers were creating more and more bugs, only to fix them and get the prize',
    expectsThumbnail: true,
  },
  {
    label: 'Medium (friends link)',
    url: 'https://fagnerbrack.com/the-problem-you-solve-is-more-important-than-the-code-you-write-d0e5493132c6?source=friends_link&sk=af337097bd3ecac5750a7fb1dcd0b91d',
    expectedContent: 'seem to have forgotten the real purpose of software',
    expectsThumbnail: true,
  },
  {
    label: 'Wikipedia (baseline)',
    url: 'https://en.wikipedia.org/wiki/Reading',
    expectedContent: 'children and adults read because it is enjoyable',
    expectsThumbnail: true,
  },
  {
    label: 'Substack',
    url: 'https://newsletter.pragmaticengineer.com/p/wrapped-the-pragmatic-engineer-in',
    expectedContent: 'Some fundamentals will not change',
    expectsThumbnail: true,
  },
  {
    label: 'NYTimes',
    url: 'https://www.nytimes.com/projects/2012/snow-fall/index.html',
    expectedContent: 'shaped like a funnel, squeezed the growing swell of churning snow into a steep, twisting gorge',
    expectsThumbnail: true,
  },
  {
    label: 'GitHub',
    url: 'https://github.com/js-cookie/js-cookie',
    expectedContent: 'All special characters that are not allowed in the cookie-name or cookie-value',
    expectsThumbnail: true,
  },
  {
    label: 'arXiv',
    url: 'https://arxiv.org/abs/1706.03762',
    expectedContent: 'Experiments on two machine translation tasks show these models',
    expectsThumbnail: true,
  },
  {
    label: 'Ars Technica',
    url: 'https://arstechnica.com/features/2005/10/linux/',
    expectedContent: 'following is the complete AIM sniffer',
    expectsThumbnail: true,
  },
  {
    label: 'Stack Overflow',
    url: 'https://stackoverflow.com/questions/11227809/why-is-processing-a-sorted-array-faster-than-processing-an-unsorted-array',
    expectedContent: 'You are a blind operator of a junction and you hear a train coming',
    expectsThumbnail: true,
  },
  {
    label: 'The New Yorker',
    url: 'https://www.newyorker.com/magazine/1946/08/31/hiroshima',
    expectedContent: 'Mr. Matsuo dashed up the front steps into the house and dived among the bedrolls and buried himself there',
    expectsThumbnail: true,
  },
  {
    label: 'LinkedIn',
    url: 'https://www.linkedin.com/posts/fagnerbrack_ai-webdev-softwareengineering-activity-7429345910167453696-2MJD?utm_source=share&utm_medium=member_desktop&rcm=ACoAAA5sDgUBEQM_1ZyxJFG0-Bvfm4gOYd-wqo4',
    expectedContent: 'The issue now is that people realised coding was never the bottleneck',
    expectsThumbnail: true,
  },
  {
    label: 'X (Twitter)',
    url: 'https://x.com/elonmusk/status/1519480761749016577',
    expectedContent: 'buying Coca-Cola to put the cocaine back in',
    expectsThumbnail: false,
  },
  {
    // NYTimes news articles sit behind DataDome (Fastly + server: DataDome,
    // x-datadome: protected). A vanilla fetch returns 403 with a captcha
    // page; the crawler's browser-like headers defeat that locally, but CI
    // egress IPs may be flagged differently.
    label: 'NYTimes (business article, DataDome)',
    url: 'https://www.nytimes.com/2026/04/20/business/infowars-alex-jones-the-onion.html',
    expectedContent: 'probably sometime in the next two weeks',
    expectsThumbnail: true,
  },
  {
    // Minimal static HTML — no edge sniffer, no og:image. The article body
    // contains the snippet but wrapped around newlines inside <p> tags, so
    // use a snippet that does not cross a line break.
    label: 'Static HTML (hex.ooo)',
    url: 'https://hex.ooo/library/last_question.html',
    expectedContent: 'he had had to carry the ice and glassware',
    expectsThumbnail: false,
  },
  {
    // qwen.ai renders the blog client-side: the HTML body is a bootstrap
    // <script> tag and the article text only materialises after JS runs.
    // A fetch-based crawler cannot see the content without headless rendering.
    label: 'Qwen.ai (SPA blog)',
    url: 'https://qwen.ai/blog?id=qwen3.6-27b',
    expectedContent: 'Qwen3.6-27B demonstrates that a well-trained dense model can surpass much larger predecessors on the tasks that matter most for developers',
    expectsThumbnail: true,
  },
];
