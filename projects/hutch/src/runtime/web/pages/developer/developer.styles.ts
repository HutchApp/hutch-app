import { readFileSync } from "node:fs";
import { join } from "node:path";

const stylesPath = join(__dirname, "developer.styles.css");
export const DEVELOPER_PAGE_STYLES = readFileSync(stylesPath, "utf-8");
