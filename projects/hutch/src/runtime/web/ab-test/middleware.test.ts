import { EventEmitter } from "node:events";
import type { NextFunction, Request, Response } from "express";
import { AB_VISITOR_COOKIE_NAME } from "./ab-cookie";
import { deriveVisitorIdForVariant } from "./derive-visitor-id.test-utils";
import { createAbMiddleware } from "./middleware";

const CONTROL_VISITOR_ID = deriveVisitorIdForVariant("control");
const TREATMENT_VISITOR_ID = deriveVisitorIdForVariant("treatment-founding-cta");

interface CookieCall {
	name: string;
	value: unknown;
	options?: unknown;
}

interface MockReqOverrides {
	cookies?: Record<string, unknown>;
	userAgent?: string;
	path?: string;
}

function createReq(overrides: MockReqOverrides = {}): Request {
	const headers: Record<string, string | undefined> = {
		"user-agent":
			overrides.userAgent ??
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/145.0",
	};
	return {
		path: overrides.path ?? "/",
		cookies: overrides.cookies ?? {},
		headers,
		get(name: string): string | undefined {
			return headers[name.toLowerCase()];
		},
	} as unknown as Request;
}

function createRes(): { res: Response; cookieCalls: CookieCall[] } {
	const cookieCalls: CookieCall[] = [];
	const res = new EventEmitter() as unknown as Response & EventEmitter;
	res.cookie = (name: string, value: unknown, options?: unknown): Response => {
		cookieCalls.push({ name, value, options });
		return res;
	};
	return { res, cookieCalls };
}

function run(req: Request) {
	const { res, cookieCalls } = createRes();
	const calls: number[] = [];
	const next: NextFunction = () => calls.push(1);
	const middleware = createAbMiddleware({
		generateVisitorId: () => CONTROL_VISITOR_ID,
	});
	middleware(req, res, next);
	return { req, res, cookieCalls, nextCalls: calls.length };
}

describe("createAbMiddleware", () => {
	it("assigns a fresh visitor id and sets the cookie when no cookie is present", () => {
		const { req, cookieCalls } = run(createReq());
		expect(req.abVisitorId).toBe(CONTROL_VISITOR_ID);
		expect(cookieCalls).toEqual([
			{
				name: AB_VISITOR_COOKIE_NAME,
				value: CONTROL_VISITOR_ID,
				options: expect.objectContaining({
					httpOnly: true,
					sameSite: "lax",
					path: "/",
				}),
			},
		]);
	});

	it("derives the homepage variant from the visitor id so the response matches the cookie", () => {
		const { req } = run(createReq());
		expect(req.abHomepageVariant).toBe("control");
	});

	it("reuses the existing cookie value and does not overwrite it — assignment must be sticky across visits", () => {
		const { req, cookieCalls } = run(
			createReq({ cookies: { [AB_VISITOR_COOKIE_NAME]: TREATMENT_VISITOR_ID } }),
		);
		expect(req.abVisitorId).toBe(TREATMENT_VISITOR_ID);
		expect(req.abHomepageVariant).toBe("treatment-founding-cta");
		expect(cookieCalls).toEqual([]);
	});

	it("treats a malformed cookie value as missing and assigns a fresh id", () => {
		const { req, cookieCalls } = run(
			createReq({ cookies: { [AB_VISITOR_COOKIE_NAME]: "garbage" } }),
		);
		expect(req.abVisitorId).toBe(CONTROL_VISITOR_ID);
		expect(cookieCalls).toHaveLength(1);
	});

	it("pins bots to the control variant with no cookie — keeps the experiment clean and Googlebot stable across crawls so SEO rank signals don't get confused", () => {
		const { req, cookieCalls } = run(
			createReq({
				userAgent: "Googlebot/2.1 (+http://www.google.com/bot.html)",
			}),
		);
		expect(req.abVisitorId).toBeUndefined();
		expect(req.abHomepageVariant).toBe("control");
		expect(cookieCalls).toEqual([]);
	});

	it("calls next once per request", () => {
		const { nextCalls } = run(createReq());
		expect(nextCalls).toBe(1);
	});

	it("skips assignment entirely for metadata paths like /robots.txt — those routes don't render a variant and shouldn't pay sha256 + cookie write costs on every crawler hit", () => {
		const { req, cookieCalls } = run(createReq({ path: "/robots.txt" }));
		expect(req.abVisitorId).toBeUndefined();
		expect(req.abHomepageVariant).toBeUndefined();
		expect(cookieCalls).toEqual([]);
	});
});
