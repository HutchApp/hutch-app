// Precondition: email must contain "@" (enforced by Zod schema validation upstream)
export function normalizeEmail(email: string): string {
	return email.toLowerCase().trim();
}
