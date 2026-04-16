import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { hashIp } from "./analytics";

function loadBannedHashes(): Set<string> {
	const raw = readFileSync(join(__dirname, "banned-visitors.txt"), "utf-8");
	const hashes = new Set<string>();
	for (const line of raw.split("\n")) {
		const trimmed = line.trim();
		if (trimmed && !trimmed.startsWith("#")) {
			hashes.add(trimmed);
		}
	}
	return hashes;
}

const bannedHashes = loadBannedHashes();

export function createBanMiddleware(deps: {
	salt: string;
}): RequestHandler {
	return (req: Request, res: Response, next: NextFunction) => {
		if (bannedHashes.size === 0) {
			next();
			return;
		}
		const hash = hashIp({ ip: req.ip, salt: deps.salt });
		if (hash && bannedHashes.has(hash)) {
			res.status(403).end();
			return;
		}
		next();
	};
}
