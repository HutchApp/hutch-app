import { chromeS3Config, firefoxS3Config } from "./s3-config";

describe("chromeS3Config", () => {
	it("should build bucket name with stage", () => {
		expect(chromeS3Config.getBucketName("prod")).toBe("hutch-chrome-extension-prod");
	});

	it("should build bucket base URL", () => {
		expect(chromeS3Config.getBucketBaseUrl("prod")).toBe(
			"https://hutch-chrome-extension-prod.s3.ap-southeast-2.amazonaws.com",
		);
	});

	it("should build extension download URL", () => {
		expect(chromeS3Config.getExtensionDownloadUrl({ stage: "prod", filename: "hutch-1.0.0.zip" })).toBe(
			"https://hutch-chrome-extension-prod.s3.ap-southeast-2.amazonaws.com/hutch-1.0.0.zip",
		);
	});

	it("should build latest pointer URL", () => {
		expect(chromeS3Config.getLatestPointerUrl("prod")).toBe(
			"https://hutch-chrome-extension-prod.s3.ap-southeast-2.amazonaws.com/latest.txt",
		);
	});

	it("should build update manifest URL", () => {
		expect(chromeS3Config.getUpdateManifestUrl("prod", "updates.xml")).toBe(
			"https://hutch-chrome-extension-prod.s3.ap-southeast-2.amazonaws.com/updates.xml",
		);
	});
});

describe("firefoxS3Config", () => {
	it("should build bucket name with stage", () => {
		expect(firefoxS3Config.getBucketName("prod")).toBe("hutch-extension-prod");
	});

	it("should build extension download URL", () => {
		expect(firefoxS3Config.getExtensionDownloadUrl({ stage: "prod", filename: "hutch-1.0.0.xpi" })).toBe(
			"https://hutch-extension-prod.s3.ap-southeast-2.amazonaws.com/hutch-1.0.0.xpi",
		);
	});
});
