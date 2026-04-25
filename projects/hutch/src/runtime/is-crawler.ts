import type { Request } from "express";
import { isbot } from "isbot";

export function isCrawler(req: Request): boolean {
	return isbot(req.get("user-agent"));
}
