import { readFileSync } from "node:fs";
import { join } from "node:path";

const stylesPath = join(__dirname, "base.styles.css");
export const BASE_STYLES = readFileSync(stylesPath, "utf-8");
