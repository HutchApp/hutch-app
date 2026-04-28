/**
 * URLs matching any of these regexes are not real articles — own-domain pages,
 * browser-internal URLs, the AWS console, and the user's own Medium profile
 * root. Rows whose `originalUrl` matches an entry are dropped before the
 * canary classifies them, so a stuck row pointing at one of these targets
 * does not flag the run red.
 *
 * Mirrors EXCLUDE_PATTERNS in /tmp/list-stuck-articles.sh — the bash variant
 * the canary replaces. Add a new entry only if the pattern represents a class
 * of URL that is genuinely never a real article.
 */
export const EXCLUDE_PATTERNS: readonly RegExp[] = [
	/:\/\/readplace\.com/,
	/:\/\/hutch-app\.com/,
	/:\/\/localhost/,
	/^about:home$/,
	/^about:newtab$/,
	/^chrome:\/\//,
	/278728209435-wu2vbie3\.ap-southeast-2\.console\.aws\.amazon\.com/,
	/:\/\/medium\.com\/@fagnerbrack/,
];
