type EventHandler = (...args: unknown[]) => void;

interface EventBus {
	on: (event: string, handler: EventHandler) => void;
	once: (event: string, handler: EventHandler) => void;
	emit: (event: string, ...args: unknown[]) => void;
}

export function createEventBus(): EventBus {
	const listeners = new Map<string, EventHandler[]>();

	return {
		on(event, handler) {
			const existing = listeners.get(event) ?? [];
			existing.push(handler);
			listeners.set(event, existing);
		},
		once(event, handler) {
			const wrapper: EventHandler = (...args) => {
				const handlers = listeners.get(event) ?? [];
				const index = handlers.indexOf(wrapper);
				if (index !== -1) {
					handlers.splice(index, 1);
				}
				handler(...args);
			};
			const existing = listeners.get(event) ?? [];
			existing.push(wrapper);
			listeners.set(event, existing);
		},
		emit(event, ...args) {
			const handlers = [...(listeners.get(event) ?? [])];
			for (const handler of handlers) {
				handler(...args);
			}
		},
	};
}
