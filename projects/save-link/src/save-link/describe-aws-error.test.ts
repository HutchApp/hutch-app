import { describeAwsError } from "./describe-aws-error";

describe("describeAwsError", () => {
	it("emits name + status + fault + requestId + extendedRequestId for the SDK shape that fires when a 403 has no parseable body", () => {
		const err: Error & {
			$fault: "client";
			$metadata: { httpStatusCode: number; requestId: string; extendedRequestId: string };
		} = Object.assign(new Error("UnknownError"), {
			$fault: "client" as const,
			$metadata: {
				httpStatusCode: 403,
				requestId: "F172QMTAPW18EQ08",
				extendedRequestId: "cZFJ81aE2zsou1QmjfbnPTQJ5D43hlTAo9WMiMAnMbJg",
			},
		});
		err.name = "Unknown";

		const result = describeAwsError(err);

		expect(result).toContain("name=Unknown");
		expect(result).toContain("status=403");
		expect(result).toContain("fault=client");
		expect(result).toContain("requestId=F172QMTAPW18EQ08");
		expect(result).toContain("extendedRequestId=cZFJ81aE2zsou1QmjfbnPTQJ5D43hlTAo9WMiMAnMbJg");
		expect(result).toContain("message=UnknownError");
	});

	it("includes Code when the SDK resolves it (typical AccessDenied / ThrottlingException paths)", () => {
		const err = Object.assign(new Error("Access Denied"), {
			Code: "AccessDenied",
			$metadata: { httpStatusCode: 403, requestId: "abc" },
		});
		err.name = "AccessDeniedException";

		expect(describeAwsError(err)).toContain("code=AccessDenied");
	});

	it("includes cfId when present (CloudFront-fronted services attach it for support tickets)", () => {
		const err = Object.assign(new Error("Forbidden"), {
			$metadata: { cfId: "abcdef0123456789" },
		});

		expect(describeAwsError(err)).toContain("cfId=abcdef0123456789");
	});

	it("falls back to Error.name + Error.message when there is no $metadata, so plain throws stay readable", () => {
		const err = new Error("plain failure");

		const result = describeAwsError(err);

		expect(result).toBe("name=Error message=plain failure");
	});

	it("describes non-Error throws so a bare string or object thrown from a step still produces a useful reason", () => {
		expect(describeAwsError("just a string")).toBe("non-error: just a string");
		expect(describeAwsError(42)).toBe("non-error: 42");
		expect(describeAwsError(undefined)).toBe("non-error: undefined");
	});

	it("falls back to Error.name + Error.message when the schema rejects malformed metadata, so a corrupt SDK shape never blanks out the description", () => {
		const err = Object.assign(new Error("real message"), {
			// Code is meant to be a string per the SDK; a wrong type here makes zod
			// reject the parse so `parsed.data` is empty and we have to fall through
			// to the Error instance's own name/message.
			Code: 123,
		});

		expect(describeAwsError(err)).toBe("name=Error message=real message");
	});
});
