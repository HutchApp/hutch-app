import { createServer } from "node:net";

export function getFreePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.listen(0, () => {
			const address = server.address();
			if (!address || typeof address === "string") {
				server.close(() => reject(new Error("Failed to allocate a free port")));
				return;
			}
			const port = address.port;
			server.close(() => resolve(port));
		});
		server.on("error", reject);
	});
}
