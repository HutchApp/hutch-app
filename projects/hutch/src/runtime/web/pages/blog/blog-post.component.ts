import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { render } from "../../render";
import { BLOG_STYLES } from "./blog.styles";
import type { BlogPost } from "./blog.posts";

const BLOG_POST_TEMPLATE = readFileSync(join(__dirname, "blog-post.template.html"), "utf-8");

export function BlogPostPage(params: { post: BlogPost }): Component {
	const { post } = params;

	return Base({
		seo: {
			title: `${post.title} — Hutch Blog`,
			description: post.description,
			canonicalUrl: `https://hutch-app.com/blog/${post.slug}`,
			ogType: "article",
			author: post.author,
			keywords: post.keywords,
			structuredData: [
				{
					"@context": "https://schema.org",
					"@type": "BlogPosting",
					headline: post.title,
					description: post.description,
					datePublished: post.date,
					author: {
						"@type": "Person",
						name: post.author,
					},
					url: `https://hutch-app.com/blog/${post.slug}`,
					publisher: {
						"@type": "Organization",
						name: "Hutch",
						url: "https://hutch-app.com",
					},
				},
			],
		},
		styles: BLOG_STYLES,
		bodyClass: "page-blog-post",
		content: render(BLOG_POST_TEMPLATE, {
			title: post.title,
			date: post.date,
			formattedDate: post.formattedDate,
			author: post.author,
			htmlContent: post.htmlContent,
		}),
	});
}
