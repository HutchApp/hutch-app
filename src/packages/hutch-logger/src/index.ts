type LogMethod = (...args: unknown[]) => void;

export interface HutchLogger {
	info: LogMethod;
	error: LogMethod;
	warn: LogMethod;
	debug: LogMethod;
}

export namespace HutchLogger {
	export interface Typed<T> {
		info: (data: T) => void;
		error: (data: T) => void;
		warn: (data: T) => void;
		debug: (data: T) => void;
	}

	export function from(impl: HutchLogger): HutchLogger {
		return impl;
	}

	export function fromJSON<T>(): Typed<T> {
		return {
			info: (data: T) => console.log(JSON.stringify(data)),
			error: (data: T) => console.error(JSON.stringify(data)),
			warn: (data: T) => console.warn(JSON.stringify(data)),
			debug: (data: T) => console.debug(JSON.stringify(data)),
		};
	}
}

export const consoleLogger: HutchLogger = {
	info: console.info,
	error: console.error,
	warn: console.warn,
	debug: console.debug,
};

export const noopLogger: HutchLogger = {
	info: () => {},
	error: () => {},
	warn: () => {},
	debug: () => {},
};

