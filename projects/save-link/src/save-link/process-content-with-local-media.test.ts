import posthtml from "posthtml";
import urls from "@11ty/posthtml-urls";
import { initProcessContentWithLocalMedia, type RewriteHtmlUrls } from "./process-content-with-local-media";
import type { DownloadedMedia } from "./download-media";

const rewriteHtmlUrls: RewriteHtmlUrls = (html, rewriteUrl) => {
	const plugin = urls({ eachURL: rewriteUrl });
	return posthtml().use(plugin).process(html).then(result => result.html);
};

const processContentWithLocalMedia = initProcessContentWithLocalMedia({ rewriteHtmlUrls });

describe("processContentWithLocalMedia", () => {
	it("replaces image URLs in html with CDN URLs", async () => {
		const media: DownloadedMedia[] = [
			{ originalUrl: "https://example.com/photo.png", cdnUrl: "https://cdn.example.com/images/abc.png" },
		];

		const result = await processContentWithLocalMedia({
			html: '<p><img src="https://example.com/photo.png"></p>',
			thumbnailUrl: undefined,
			media,
		});

		expect(result.html).toContain('src="https://cdn.example.com/images/abc.png"');
	});

	it("replaces all occurrences of the same URL", async () => {
		const media: DownloadedMedia[] = [
			{ originalUrl: "https://example.com/photo.png", cdnUrl: "https://cdn.example.com/images/abc.png" },
		];

		const result = await processContentWithLocalMedia({
			html: '<img src="https://example.com/photo.png"><img src="https://example.com/photo.png">',
			thumbnailUrl: undefined,
			media,
		});

		expect(result.html).toMatch(/https:\/\/cdn\.example\.com\/images\/abc\.png.*https:\/\/cdn\.example\.com\/images\/abc\.png/);
	});

	it("replaces thumbnail URL when it matches downloaded media", async () => {
		const media: DownloadedMedia[] = [
			{ originalUrl: "https://example.com/thumb.png", cdnUrl: "https://cdn.example.com/images/thumb.png" },
		];

		const result = await processContentWithLocalMedia({
			html: "<p>text</p>",
			thumbnailUrl: "https://example.com/thumb.png",
			media,
		});

		expect(result.thumbnailUrl).toBe("https://cdn.example.com/images/thumb.png");
	});

	it("keeps thumbnail URL when it was not downloaded", async () => {
		const result = await processContentWithLocalMedia({
			html: "<p>text</p>",
			thumbnailUrl: "https://example.com/thumb.png",
			media: [],
		});

		expect(result.thumbnailUrl).toBe("https://example.com/thumb.png");
	});

	it("returns html unchanged when media array is empty", async () => {
		const result = await processContentWithLocalMedia({
			html: '<img src="https://example.com/photo.png">',
			thumbnailUrl: undefined,
			media: [],
		});

		expect(result.html).toContain("https://example.com/photo.png");
	});

	it("passes through undefined thumbnail", async () => {
		const result = await processContentWithLocalMedia({
			html: "<p>text</p>",
			thumbnailUrl: undefined,
			media: [],
		});

		expect(result.thumbnailUrl).toBeUndefined();
	});

	it("rewrites srcset entries to use CDN URLs from downloaded media", async () => {
		const media: DownloadedMedia[] = [
			{ originalUrl: "https://example.com/small.png", cdnUrl: "https://cdn.example.com/images/small.png" },
			{ originalUrl: "https://example.com/large.png", cdnUrl: "https://cdn.example.com/images/large.png" },
		];

		const result = await processContentWithLocalMedia({
			html: '<img srcset="https://example.com/small.png 300w, https://example.com/large.png 600w">',
			thumbnailUrl: undefined,
			media,
		});

		expect(result.html).toContain("https://cdn.example.com/images/small.png 300w");
		expect(result.html).toContain("https://cdn.example.com/images/large.png 600w");
	});

	it("rewrites broken srcset entries to use the img src CDN URL", async () => {
		const media: DownloadedMedia[] = [
			{ originalUrl: "https://example.com/photo.png", cdnUrl: "https://cdn.example.com/images/abc.png" },
		];

		const result = await processContentWithLocalMedia({
			html: '<img src="https://example.com/photo.png" srcset="https://example.com/broken-fragment 424w, https://example.com/another-broken 848w">',
			thumbnailUrl: undefined,
			media,
		});

		expect(result.html).toContain('src="https://cdn.example.com/images/abc.png"');
		expect(result.html).toContain("https://cdn.example.com/images/abc.png 424w");
		expect(result.html).toContain("https://cdn.example.com/images/abc.png 848w");
	});

	it("rewrites srcset mixing cached and uncached entries using src fallback", async () => {
		const media: DownloadedMedia[] = [
			{ originalUrl: "https://example.com/photo.png", cdnUrl: "https://cdn.example.com/images/abc.png" },
			{ originalUrl: "https://example.com/small.png", cdnUrl: "https://cdn.example.com/images/small.png" },
		];

		const result = await processContentWithLocalMedia({
			html: '<img src="https://example.com/photo.png" srcset="https://example.com/small.png 300w, https://example.com/uncached 600w">',
			thumbnailUrl: undefined,
			media,
		});

		expect(result.html).toContain("https://cdn.example.com/images/small.png 300w");
		expect(result.html).toContain("https://cdn.example.com/images/abc.png 600w");
	});

	it("rewrites srcset with pixel density descriptors", async () => {
		const media: DownloadedMedia[] = [
			{ originalUrl: "https://example.com/normal.png", cdnUrl: "https://cdn.example.com/images/normal.png" },
			{ originalUrl: "https://example.com/retina.png", cdnUrl: "https://cdn.example.com/images/retina.png" },
		];

		const result = await processContentWithLocalMedia({
			html: '<img srcset="https://example.com/normal.png 1x, https://example.com/retina.png 2x">',
			thumbnailUrl: undefined,
			media,
		});

		expect(result.html).toContain("https://cdn.example.com/images/normal.png 1x");
		expect(result.html).toContain("https://cdn.example.com/images/retina.png 2x");
	});

	it("rewrites srcset entry with no descriptor", async () => {
		const media: DownloadedMedia[] = [
			{ originalUrl: "https://example.com/photo.png", cdnUrl: "https://cdn.example.com/images/abc.png" },
		];

		const result = await processContentWithLocalMedia({
			html: '<img srcset="https://example.com/photo.png">',
			thumbnailUrl: undefined,
			media,
		});

		expect(result.html).toContain("https://cdn.example.com/images/abc.png");
	});

	it("rewrites srcset with commas in CDN-style URLs", async () => {
		const media: DownloadedMedia[] = [
			{ originalUrl: "https://cdn.example.com/fetch/w_424,c_limit/photo.png", cdnUrl: "https://cdn.example.com/images/small.png" },
			{ originalUrl: "https://cdn.example.com/fetch/w_848,c_limit/photo.png", cdnUrl: "https://cdn.example.com/images/large.png" },
		];

		const result = await processContentWithLocalMedia({
			html: '<img srcset="https://cdn.example.com/fetch/w_424,c_limit/photo.png 424w, https://cdn.example.com/fetch/w_848,c_limit/photo.png 848w">',
			thumbnailUrl: undefined,
			media,
		});

		expect(result.html).toContain("https://cdn.example.com/images/small.png 424w");
		expect(result.html).toContain("https://cdn.example.com/images/large.png 848w");
	});

	it("rewrites video src and poster URLs", async () => {
		const media: DownloadedMedia[] = [
			{ originalUrl: "https://example.com/video.mp4", cdnUrl: "https://cdn.example.com/media/video.mp4" },
			{ originalUrl: "https://example.com/poster.jpg", cdnUrl: "https://cdn.example.com/media/poster.jpg" },
		];

		const result = await processContentWithLocalMedia({
			html: '<video src="https://example.com/video.mp4" poster="https://example.com/poster.jpg"></video>',
			thumbnailUrl: undefined,
			media,
		});

		expect(result.html).toContain('src="https://cdn.example.com/media/video.mp4"');
		expect(result.html).toContain('poster="https://cdn.example.com/media/poster.jpg"');
	});

	it("rewrites audio src URLs", async () => {
		const media: DownloadedMedia[] = [
			{ originalUrl: "https://example.com/audio.mp3", cdnUrl: "https://cdn.example.com/media/audio.mp3" },
		];

		const result = await processContentWithLocalMedia({
			html: '<audio src="https://example.com/audio.mp3"></audio>',
			thumbnailUrl: undefined,
			media,
		});

		expect(result.html).toContain('src="https://cdn.example.com/media/audio.mp3"');
	});

	it("leaves img src unchanged when URL is not in media mapping", async () => {
		const media: DownloadedMedia[] = [
			{ originalUrl: "https://example.com/other.png", cdnUrl: "https://cdn.example.com/images/other.png" },
		];

		const result = await processContentWithLocalMedia({
			html: '<img src="https://example.com/uncached.png">',
			thumbnailUrl: undefined,
			media,
		});

		expect(result.html).toContain('src="https://example.com/uncached.png"');
	});

	it("leaves link href unchanged when URL is not in media mapping", async () => {
		const media: DownloadedMedia[] = [
			{ originalUrl: "https://example.com/photo.png", cdnUrl: "https://cdn.example.com/images/abc.png" },
		];

		const result = await processContentWithLocalMedia({
			html: '<a href="https://example.com/page">link</a><img src="https://example.com/photo.png">',
			thumbnailUrl: undefined,
			media,
		});

		expect(result.html).toContain('href="https://example.com/page"');
		expect(result.html).toContain('src="https://cdn.example.com/images/abc.png"');
	});
});
