import { readFileSync } from "node:fs";
import { join } from "node:path";

const stylesPath = join(__dirname, "gmail-import.styles.css");
export const GMAIL_IMPORT_STYLES = readFileSync(stylesPath, "utf-8");
