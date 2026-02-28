declare namespace browser {
	namespace runtime {
		function sendMessage(message: unknown): Promise<unknown>;
		function getURL(path: string): string;

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
			id?: number;
			url?: string;
			title?: string;
		}

		function query(queryInfo: {
			active: boolean;
			currentWindow: boolean;
		}): Promise<Tab[]>;

		function get(tabId: number): Promise<Tab>;

		const onActivated: {
			addListener(
				callback: (activeInfo: { tabId: number }) => void,
			): void;
		};

		const onUpdated: {
			addListener(
				callback: (
					tabId: number,
					changeInfo: { url?: string; status?: string },
					tab: Tab,
				) => void,
			): void;
		};
	}

	namespace browserAction {
		function setIcon(details: {
			tabId?: number;
			path?: Record<number, string>;
			imageData?: Record<number, ImageData>;
		}): Promise<void>;
	}
}
