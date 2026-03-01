import { app } from "./app";
import { PORT } from "./server";

app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});
