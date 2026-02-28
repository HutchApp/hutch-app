declare namespace browser {
	namespace runtime {
		function sendMessage(message: unknown): Promise<unknown>;

		const onMessage: {
			addListener(
				callback: (
					message: unknown,
					sender: unknown,
					sendResponse: (response: unknown) => void,
				) => true | undefined,
			): void;
		};
	}

	namespace tabs {
		interface Tab {
			url?: string;
			title?: string;
		}

		function query(queryInfo: {
			active: boolean;
			currentWindow: boolean;
		}): Promise<Tab[]>;
	}
}
