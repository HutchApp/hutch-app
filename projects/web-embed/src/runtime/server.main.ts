import { loadConfigFromEnv } from "./config";
import { createApp } from "./server";

const config = loadConfigFromEnv();
const app = createApp(config);

const server = app.listen(config.port, () => {
	const address = server.address();
	const port = typeof address === "string" ? address : address?.port;
	console.log(`Readplace embed server running on http://localhost:${port}`);
});
