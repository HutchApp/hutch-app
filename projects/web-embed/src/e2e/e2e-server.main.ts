import { requireEnv } from "../runtime/require-env";
import { createApp } from "../runtime/server";

const port = Number(requireEnv("E2E_PORT"));
const embedOrigin = `http://localhost:${port}`;

const app = createApp({
	port,
	appOrigin: "https://readplace.com",
	embedOrigin,
});

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));

app.listen(port, () => {
	console.log(`E2E server running on ${embedOrigin}`);
});
