import type { Request, Response, Router } from "express";
import express from "express";
import { BlogIndexPage } from "./blog-index.component";
import { BlogPostPage } from "./blog-post.component";
import { NotFoundPage } from "../not-found";
import { getAllPosts, findPostBySlug } from "./blog.posts";

export function initBlogRoutes(): Router {
	const router = express.Router();

	router.get("/", (_req: Request, res: Response) => {
		const posts = getAllPosts();
		const html = BlogIndexPage({ posts }).to("text/html");
		res.status(html.statusCode).type("html").send(html.body);
	});

	router.get("/:slug", (req: Request, res: Response) => {
		const post = findPostBySlug(req.params.slug);
		if (!post) {
			const html = NotFoundPage().to("text/html");
			res.status(404).type("html").send(html.body);
			return;
		}
		const html = BlogPostPage({ post }).to("text/html");
		res.status(html.statusCode).type("html").send(html.body);
	});

	return router;
}
