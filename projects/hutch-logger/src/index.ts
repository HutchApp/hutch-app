type LogMethod = (...args: unknown[]) => void;

export interface HutchLogger {
	info: LogMethod;
	error: LogMethod;
	warn: LogMethod;
	debug: LogMethod;
}

export const consoleLogger: HutchLogger = {
	info: console.log,
	error: console.error,
	warn: console.warn,
	debug: console.debug,
};
