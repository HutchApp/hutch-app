import assert from "node:assert";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";
import { z } from "zod";
import matter from "gray-matter";
import MarkdownIt from "markdown-it";

const md = new MarkdownIt();

const BlogFrontmatter = z.object({
	title: z.string(),
	description: z.string(),
	slug: z.string(),
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	author: z.string(),
	keywords: z.string().optional(),
});

export type BlogPost = z.infer<typeof BlogFrontmatter> & {
	htmlContent: string;
	formattedDate: string;
};

function formatDate(isoDate: string): string {
	const date = new Date(isoDate + "T00:00:00Z");
	return date.toLocaleDateString("en-AU", {
		day: "numeric",
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	});
}

function discoverPostFiles(): { filePath: string; fileName: string }[] {
	const postsSubdir = join(__dirname, "posts");
	if (existsSync(postsSubdir)) {
		return readdirSync(postsSubdir)
			.filter((f) => f.endsWith(".md"))
			.map((f) => ({ filePath: join(postsSubdir, f), fileName: f }));
	}
	/* Lambda asset bundler flattens all files into __dirname */
	return readdirSync(__dirname)
		.filter((f) => f.endsWith(".md"))
		.map((f) => ({ filePath: join(__dirname, f), fileName: f }));
}

const postFiles = discoverPostFiles();

const posts: BlogPost[] = postFiles
	.map(({ filePath, fileName }) => {
		const raw = readFileSync(filePath, "utf-8");
		const { data, content } = matter(raw);
		const result = BlogFrontmatter.safeParse(data);
		if (!result.success) return null;
		const frontmatter = result.data;

		const expectedSlug = basename(fileName, ".md");
		assert(
			frontmatter.slug === expectedSlug,
			`Slug "${frontmatter.slug}" in ${fileName} does not match filename "${expectedSlug}"`,
		);

		return {
			...frontmatter,
			htmlContent: md.render(content),
			formattedDate: formatDate(frontmatter.date),
		};
	})
	.filter((post): post is BlogPost => post !== null)
	.sort((a, b) => b.date.localeCompare(a.date));

const slugSet = new Set(posts.map((p) => p.slug));
assert(slugSet.size === posts.length, "Duplicate blog post slugs detected");

export function getAllPosts(): BlogPost[] {
	return posts;
}

export function findPostBySlug(slug: string): BlogPost | undefined {
	return posts.find((p) => p.slug === slug);
}

export function getAllSlugs(): string[] {
	return posts.map((p) => p.slug);
}
