import { z } from "zod";

export const SaveArticleInputSchema = z.object({
	url: z.url({ message: "Please enter a valid URL" }),
});
