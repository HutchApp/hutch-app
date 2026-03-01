import { readFileSync } from "node:fs";
import { join } from "node:path";

const stylesPath = join(__dirname, "auth.styles.css");
export const AUTH_STYLES = readFileSync(stylesPath, "utf-8");
