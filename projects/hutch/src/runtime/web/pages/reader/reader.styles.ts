import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ARTICLE_BODY_STYLES } from "../../shared/article-body/article-body.styles";

const stylesPath = join(__dirname, "reader.styles.css");
const READER_ONLY_STYLES = readFileSync(stylesPath, "utf-8");

export const READER_STYLES = `${ARTICLE_BODY_STYLES}\n${READER_ONLY_STYLES}`;
