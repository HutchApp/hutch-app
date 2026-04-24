import request from "supertest";
import { createTestAppFromFixture } from "../../../test-app";
import {
	TEST_APP_ORIGIN,
	createDefaultTestAppFixture,
} from "../../../test-app-fakes";

const ARTICLE_URL = "https://example.com/post";
const ENCODED = encodeURIComponent(ARTICLE_URL);

describe("View article rate limit", () => {
	let nowMock: jest.SpyInstance<number, []>;

	beforeEach(() => {
		nowMock = jest.spyOn(Date, "now").mockReturnValue(1_000_000);
	});

	afterEach(() => {
		nowMock.mockRestore();
	});

	it("blocks the 21st request in a 10s window and resets after the window slides", async () => {
		const fixture = createDefaultTestAppFixture(TEST_APP_ORIGIN);
		const { app } = createTestAppFromFixture({
			...fixture,
			events: {
				publishLinkSaved: fixture.events.publishLinkSaved,
				publishSaveAnonymousLink: async () => {},
				publishSaveLinkRawHtmlCommand: fixture.events.publishSaveLinkRawHtmlCommand,
				publishUpdateFetchTimestamp: fixture.events.publishUpdateFetchTimestamp,
			},
		});

		for (let i = 0; i < 20; i++) {
			expect((await request(app).get(`/view/${ENCODED}`)).status).toBe(200);
		}

		const blocked = await request(app).get(`/view/${ENCODED}`);
		expect(blocked.status).toBe(429);
		expect(blocked.text).toBe("");

		nowMock.mockReturnValue(1_000_000 + 10_001);

		expect((await request(app).get(`/view/${ENCODED}`)).status).toBe(200);
	});

	it("tracks each URL in its own counter (per-URL isolation)", async () => {
		const fixture = createDefaultTestAppFixture(TEST_APP_ORIGIN);
		const { app } = createTestAppFromFixture({
			...fixture,
			events: {
				publishLinkSaved: fixture.events.publishLinkSaved,
				publishSaveAnonymousLink: async () => {},
				publishSaveLinkRawHtmlCommand: fixture.events.publishSaveLinkRawHtmlCommand,
				publishUpdateFetchTimestamp: fixture.events.publishUpdateFetchTimestamp,
			},
		});
		const urlA = encodeURIComponent("https://example.com/a");
		const urlB = encodeURIComponent("https://example.com/b");

		for (let i = 0; i < 20; i++) {
			expect((await request(app).get(`/view/${urlA}`)).status).toBe(200);
		}
		expect((await request(app).get(`/view/${urlA}`)).status).toBe(429);
		expect((await request(app).get(`/view/${urlB}`)).status).toBe(200);
	});
});
