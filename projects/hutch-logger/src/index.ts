type LogMethod = (...args: unknown[]) => void;

export interface LogMethods {
	info: LogMethod;
	error: LogMethod;
	warn: LogMethod;
	debug: LogMethod;
}

export type HutchLogger = LogMethods;

export function createHutchLogger(
	methods: LogMethods,
): (_config: Record<string, unknown>) => HutchLogger {
	return (_config) => ({
		info: (...args) => methods.info(...args),
		error: (...args) => methods.error(...args),
		warn: (...args) => methods.warn(...args),
		debug: (...args) => methods.debug(...args),
	});
}
