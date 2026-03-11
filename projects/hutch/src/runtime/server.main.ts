import { consoleLogger } from "hutch-logger";
import { app } from "./app";
import { PORT } from "./server";

app.listen(PORT, () => {
	consoleLogger.info(`Server is running on http://localhost:${PORT}`);
});
