export function headerOrUndefined(headers: Headers, name: string): string | undefined {
	const value = headers.get(name);
	return value === null ? undefined : value;
}
