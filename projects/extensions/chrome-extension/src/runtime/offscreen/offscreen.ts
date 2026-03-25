import browser from "webextension-polyfill";

const SAVED_COLOR = "#3D8B6E";
const ICON_SIZES = [16, 32, 48, 64] as const;

interface SerializedImageData {
	width: number;
	height: number;
	data: number[];
}

async function tintIcon(size: number, color: string): Promise<SerializedImageData> {
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

	const imageData = ctx.getImageData(0, 0, size, size);
	return {
		width: imageData.width,
		height: imageData.height,
		data: Array.from(imageData.data),
	};
}

let savedIconCache: Record<number, SerializedImageData> | null = null;

async function getSavedIconData(): Promise<Record<number, SerializedImageData>> {
	if (savedIconCache) return savedIconCache;
	const entries = await Promise.all(
		ICON_SIZES.map(
			async (size) => [size, await tintIcon(size, SAVED_COLOR)] as const,
		),
	);
	savedIconCache = Object.fromEntries(entries);
	return savedIconCache;
}

browser.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
	const message = raw as { target?: string; type?: string };
	if (message.target !== "offscreen") return;

	if (message.type === "get-saved-icon-data") {
		getSavedIconData().then(sendResponse);
		return true;
	}

	return undefined;
});
