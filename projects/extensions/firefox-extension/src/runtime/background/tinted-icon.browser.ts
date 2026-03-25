import type { SetIcon } from "browser-extension-core";

const SAVED_COLOR = "#3D8B6E";
const ICON_SIZES = [16, 32, 48, 64] as const;

const DEFAULT_PATHS: Record<number, string> = {
	16: "icons/icon-16.png",
	32: "icons/icon-32.png",
	48: "icons/icon-48.png",
	64: "icons/icon-64.png",
};

async function tintIcon(size: number, color: string): Promise<ImageData> {
	const url = browser.runtime.getURL(`icons/icon-${size}.png`);
	const response = await fetch(url);
	const blob = await response.blob();
	const bitmap = await createImageBitmap(blob);

	const canvas = new OffscreenCanvas(size, size);
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		throw new Error("Failed to get canvas context");
	}

	ctx.drawImage(bitmap, 0, 0, size, size);
	ctx.globalCompositeOperation = "source-in";
	ctx.fillStyle = color;
	ctx.fillRect(0, 0, size, size);

	return ctx.getImageData(0, 0, size, size);
}

let savedIconCache: Record<number, ImageData> | null = null;

async function getSavedIconData(): Promise<Record<number, ImageData>> {
	if (savedIconCache) return savedIconCache;
	const entries = await Promise.all(
		ICON_SIZES.map(
			async (size) => [size, await tintIcon(size, SAVED_COLOR)] as const,
		),
	);
	savedIconCache = Object.fromEntries(entries);
	return savedIconCache;
}

export function createBrowserSetIcon(): SetIcon {
	return {
		showSaved: async (tabId) => {
			const imageData = await getSavedIconData();
			await browser.browserAction.setIcon({ tabId, imageData });
		},
		showDefault: async (tabId) => {
			await browser.browserAction.setIcon({ tabId, path: DEFAULT_PATHS });
		},
	};
}
