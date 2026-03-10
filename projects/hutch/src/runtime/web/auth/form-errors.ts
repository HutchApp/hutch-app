export interface FieldError {
	field: string;
	message: string;
}

export function toFieldViewModel(
	errors: FieldError[] | undefined,
	field: string,
): { errorClass: string; error?: string } {
	const error = errors?.find((e) => e.field === field);
	return {
		errorClass: error ? " auth-form__input--error" : "",
		error: error?.message,
	};
}

export function flattenZodErrors(
	issues: { path: PropertyKey[]; message: string }[],
): FieldError[] {
	return issues.map((issue) => ({
		field: String(issue.path[issue.path.length - 1]),
		message: issue.message,
	}));
}
