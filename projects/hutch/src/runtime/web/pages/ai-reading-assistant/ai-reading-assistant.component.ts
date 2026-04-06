import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { render } from "../../render";
import { AI_READING_ASSISTANT_PAGE_STYLES } from "./ai-reading-assistant.styles";

const TEMPLATE = readFileSync(join(__dirname, "ai-reading-assistant.template.html"), "utf-8");

export function AiReadingAssistantPage(): Component {
	return Base({
		seo: {
			title: "AI Reading Assistant — Hutch Helps You Read More, Not Less",
			description:
				"Hutch is an AI reading assistant that helps you read more of the right things. TL;DR summaries for triage, not auto-curation. You decide what to read. AI helps you decide faster.",
			canonicalUrl: "https://hutch-app.com/ai-reading-assistant",
			ogType: "website",
			keywords:
				"AI reading assistant, read it later, AI summaries, reading tool, article triage, distraction free reading, Pocket alternative",
		},
		styles: AI_READING_ASSISTANT_PAGE_STYLES,
		headerVariant: "transparent",
		bodyClass: "page-ai-reading-assistant",
		content: render(TEMPLATE, {}),
	});
}
