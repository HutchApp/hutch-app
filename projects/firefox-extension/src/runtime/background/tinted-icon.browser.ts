import type { SetIcon } from "./icon-status";

const SAVED_COLOR = "#22c55e";
const ICON_SIZES = [16, 32, 48, 64] as const;

const DEFAULT_PATHS: Record<number, string> = {
	16: "icons/icon-16.png",
	32: "icons/icon-32.png",
	48: "icons/icon-48.png",
	64: "icons/icon-64.png",
};

function tintIcon(size: number, color: string): Promise<ImageData> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			const canvas = document.createElement("canvas");
			canvas.width = size;
			canvas.height = size;
			const ctx = canvas.getContext("2d");
			if (!ctx) {
				reject(new Error("Failed to get canvas context"));
				return;
			}
			ctx.drawImage(img, 0, 0, size, size);
			ctx.globalCompositeOperation = "source-in";
			ctx.fillStyle = color;
			ctx.fillRect(0, 0, size, size);
			resolve(ctx.getImageData(0, 0, size, size));
		};
		img.onerror = () => reject(new Error(`Failed to load icon-${size}.png`));
		img.src = browser.runtime.getURL(`icons/icon-${size}.png`);
	});
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
