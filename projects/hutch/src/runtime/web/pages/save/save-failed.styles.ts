import { readFileSync } from "node:fs";
import { join } from "node:path";

const stylesPath = join(__dirname, "save-failed.styles.css");
export const SAVE_FAILED_STYLES = readFileSync(stylesPath, "utf-8");
