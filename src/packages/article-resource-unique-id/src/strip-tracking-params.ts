const TRACKING_PARAM_NAMES: ReadonlySet<string> = new Set(["gi", "source", "sk"]);
const TRACKING_PARAM_PREFIXES = ["utm_"] as const;

export function stripTrackingParams(url: string): string {
	const parsed = new URL(url);
	const keep: [string, string][] = [];
	for (const [key, value] of parsed.searchParams) {
		if (TRACKING_PARAM_NAMES.has(key)) continue;
		if (TRACKING_PARAM_PREFIXES.some((prefix) => key.startsWith(prefix))) continue;
		keep.push([key, value]);
	}
	keep.sort(([a], [b]) => a.localeCompare(b));
	parsed.search = "";
	for (const [key, value] of keep) {
		parsed.searchParams.append(key, value);
	}
	return parsed.toString();
}
