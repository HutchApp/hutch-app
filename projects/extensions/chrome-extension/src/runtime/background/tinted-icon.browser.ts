import browser from "webextension-polyfill";
import type { SetIcon } from "browser-extension-core";

interface SerializedImageData {
	width: number;
	height: number;
	data: number[];
}

const DEFAULT_PATHS: Record<number, string> = {
	16: "icons/icon-16.png",
	32: "icons/icon-32.png",
	48: "icons/icon-48.png",
	64: "icons/icon-64.png",
};

let offscreenCreated = false;

async function ensureOffscreen(): Promise<void> {
	if (offscreenCreated) return;
	const hasDoc = await chrome.offscreen.hasDocument();
	if (hasDoc) {
		offscreenCreated = true;
		return;
	}
	await chrome.offscreen.createDocument({
		url: "offscreen/offscreen.html",
		reasons: ["CANVAS"],
		justification: "Tinting extension icons for saved state",
	});
	offscreenCreated = true;
}

let savedIconCache: Record<number, ImageData> | null = null;

async function getSavedIconData(): Promise<Record<number, ImageData>> {
	if (savedIconCache) return savedIconCache;

	await ensureOffscreen();

	const rawData = (await browser.runtime.sendMessage({
		target: "offscreen",
		type: "get-saved-icon-data",
	})) as Record<number, SerializedImageData>;

	const result: Record<number, ImageData> = {};
	for (const [size, { width, height, data }] of Object.entries(rawData)) {
		result[Number(size)] = new ImageData(
			new Uint8ClampedArray(data),
			width,
			height,
		);
	}
	savedIconCache = result;
	return result;
}

export function createBrowserSetIcon(): SetIcon {
	return {
		showSaved: async (tabId) => {
			const imageData = await getSavedIconData();
			await browser.action.setIcon({ tabId, imageData });
		},
		showDefault: async (tabId) => {
			await browser.action.setIcon({ tabId, path: DEFAULT_PATHS });
		},
	};
}
