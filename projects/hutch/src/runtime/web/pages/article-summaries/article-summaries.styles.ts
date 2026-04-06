import { readFileSync } from "node:fs";
import { join } from "node:path";

const stylesPath = join(__dirname, "article-summaries.styles.css");
export const ARTICLE_SUMMARIES_STYLES = readFileSync(stylesPath, "utf-8");
