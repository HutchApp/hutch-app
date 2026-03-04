import { readFileSync } from "node:fs";
import { join } from "node:path";

const stylesPath = join(__dirname, "reader.styles.css");
export const READER_STYLES = readFileSync(stylesPath, "utf-8");
