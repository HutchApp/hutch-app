import type { Request, Response, Router } from "express";
import express from "express";
import { renderPage } from "../../render-page";
import { sendComponent } from "../../send-component";
import { BlogIndexPage } from "./blog-index.component";
import { BlogPostPage } from "./blog-post.component";
import { NotFoundPage } from "../not-found";
import { getAllPosts, findPostBySlug } from "./blog.posts";

export function initBlogRoutes(): Router {
	const router = express.Router();

	router.get("/", (req: Request, res: Response) => {
		const posts = getAllPosts();
		sendComponent(res, renderPage(req, BlogIndexPage({ posts })));
	});

	router.get("/:slug", (req: Request, res: Response) => {
		const post = findPostBySlug(req.params.slug);
		if (!post) {
			sendComponent(res, renderPage(req, NotFoundPage()));
			return;
		}
		sendComponent(res, renderPage(req, BlogPostPage({ post })));
	});

	return router;
}
