import { createHutchLogger } from "hutch-logger";
import { app } from "./app";
import { PORT } from "./server";

const hutchLogger = createHutchLogger({
	info: console.log,
	error: console.error,
	warn: console.warn,
	debug: console.debug,
})({});

app.listen(PORT, () => {
	hutchLogger.info(`Server is running on http://localhost:${PORT}`);
});
