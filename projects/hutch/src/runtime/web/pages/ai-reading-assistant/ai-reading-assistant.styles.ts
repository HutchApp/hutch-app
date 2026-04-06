import { readFileSync } from "node:fs";
import { join } from "node:path";

const stylesPath = join(__dirname, "ai-reading-assistant.styles.css");
export const AI_READING_ASSISTANT_PAGE_STYLES = readFileSync(stylesPath, "utf-8");
