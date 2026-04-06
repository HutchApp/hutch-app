import { readFileSync } from "node:fs";
import { join } from "node:path";

const stylesPath = join(__dirname, "omnivore-alternative.styles.css");
export const OMNIVORE_ALTERNATIVE_PAGE_STYLES = readFileSync(stylesPath, "utf-8");
