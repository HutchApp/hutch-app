import { UserIdSchema } from "@packages/domain/user";
import { bannerStateFromRequest } from "./banner-state";

const USER_ID = UserIdSchema.parse("user-1");

describe("bannerStateFromRequest", () => {
	it("maps a present userId to isAuthenticated=true", () => {
		expect(bannerStateFromRequest({ userId: USER_ID })).toMatchObject({
			isAuthenticated: true,
		});
	});

	it("maps a missing userId to isAuthenticated=false", () => {
		expect(bannerStateFromRequest({})).toMatchObject({
			isAuthenticated: false,
		});
	});

	it("passes emailVerified through unchanged for true, false, and undefined", () => {
		expect(bannerStateFromRequest({ emailVerified: true }).emailVerified).toBe(true);
		expect(bannerStateFromRequest({ emailVerified: false }).emailVerified).toBe(false);
		expect(bannerStateFromRequest({}).emailVerified).toBeUndefined();
	});

	it("sets featureImport=true only when query.feature === 'import'", () => {
		expect(bannerStateFromRequest({ query: { feature: "import" } }).featureImport).toBe(true);
		expect(bannerStateFromRequest({ query: { feature: "something-else" } }).featureImport).toBe(false);
		expect(bannerStateFromRequest({}).featureImport).toBe(false);
	});
});
