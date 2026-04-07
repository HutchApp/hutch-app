import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { render } from "../../render";
import { BLOG_STYLES } from "./blog.styles";
import type { BlogPost } from "./blog.posts";

const BLOG_INDEX_TEMPLATE = readFileSync(join(__dirname, "blog-index.template.html"), "utf-8");

export function BlogIndexPage(params: { posts: BlogPost[] }): Component {
	return Base({
		seo: {
			title: "Blog — Hutch",
			description:
				"Articles about reading, building software, and the tools behind Hutch.",
			canonicalUrl: "https://hutch-app.com/blog",
			ogType: "website",
		},
		styles: BLOG_STYLES,
		bodyClass: "page-blog",
		content: render(BLOG_INDEX_TEMPLATE, { posts: params.posts }),
	});
}
