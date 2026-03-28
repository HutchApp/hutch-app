import { getAndClearJustSaved, JUST_SAVED_KEY, type StorageApi } from "./just-saved";

function createFakeStorage(data: Record<string, unknown> = {}): StorageApi {
	const store = { ...data };
	return {
		async get(key: string) {
			return { [key]: store[key] ?? undefined };
		},
		async remove(key: string) {
			delete store[key];
		},
	};
}

describe("getAndClearJustSaved", () => {
	it("returns null when no data is stored", async () => {
		const storage = createFakeStorage();
		const result = await getAndClearJustSaved(storage);
		expect(result).toBeNull();
	});

	it("returns saved data and clears it", async () => {
		const storage = createFakeStorage({
			[JUST_SAVED_KEY]: { url: "https://example.com", title: "Example" },
		});

		const result = await getAndClearJustSaved(storage);
		expect(result).toEqual({ url: "https://example.com", title: "Example" });

		const second = await getAndClearJustSaved(storage);
		expect(second).toBeNull();
	});

	it("returns null for invalid data shape", async () => {
		const storage = createFakeStorage({
			[JUST_SAVED_KEY]: { bad: "data" },
		});

		const result = await getAndClearJustSaved(storage);
		expect(result).toBeNull();
	});

	it("returns null for non-object data", async () => {
		const storage = createFakeStorage({
			[JUST_SAVED_KEY]: "not-an-object",
		});

		const result = await getAndClearJustSaved(storage);
		expect(result).toBeNull();
	});
});
