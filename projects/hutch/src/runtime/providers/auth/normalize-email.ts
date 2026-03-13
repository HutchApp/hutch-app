export function normalizeEmail(email: string): string {
	const trimmedLower = email.toLowerCase().trim();
	const [localPart, domain] = trimmedLower.split("@");
	const stripped = localPart.split("+")[0];
	return `${stripped}@${domain}`;
}
