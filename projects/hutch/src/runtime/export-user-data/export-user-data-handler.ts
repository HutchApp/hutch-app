import type { Handler, SQSEvent } from "aws-lambda";
import type { HutchLogger } from "@packages/hutch-logger";
import {
	ExportUserDataCommand,
	type ExportUserDataDetail,
	UserDataExportedEvent,
} from "@packages/hutch-infra-components";
import type { PublishEvent } from "@packages/hutch-infra-components/runtime";
import type { FindArticlesByUser } from "../providers/article-store/article-store.types";
import type { UserId } from "../domain/user/user.types";
import type { SendEmail } from "../providers/email/email.types";
import type { UploadUserDataExport } from "../providers/user-data-export/user-data-export.types";
import {
	type ExportEnvelope,
	toExportArticle,
} from "../web/pages/export/build-export-record";
import { EXPORT_DOWNLOAD_TTL_DAYS } from "../web/pages/export/export-ttl";
import { buildUserDataExportEmailHtml } from "../web/pages/export/user-data-export-email";

const EMAIL_FROM = "Readplace <hutch@hutch-app.com>";
const PAGE_SIZE = 500;

export interface ExportUserDataDependencies {
	findArticlesByUser: FindArticlesByUser;
	uploadUserDataExport: UploadUserDataExport;
	sendEmail: SendEmail;
	publishEvent: PublishEvent;
	logger: HutchLogger;
	now: () => Date;
}

export function initExportUserDataHandler(deps: ExportUserDataDependencies): Handler<SQSEvent> {
	return async (event) => {
		for (const record of event.Records) {
			const envelope = JSON.parse(record.body) as { detail: unknown };
			const detail = ExportUserDataCommand.detailSchema.parse(envelope.detail);
			await processCommand(detail, deps);
		}
	};
}

async function processCommand(
	detail: ExportUserDataDetail,
	deps: ExportUserDataDependencies,
): Promise<void> {
	const userId = detail.userId as UserId;

	const articles: ExportEnvelope["articles"] = [];
	let page = 1;
	while (true) {
		const result = await deps.findArticlesByUser({
			userId,
			page,
			pageSize: PAGE_SIZE,
			order: "asc",
		});
		for (const article of result.articles) articles.push(toExportArticle(article));
		if (articles.length >= result.total) break;
		page++;
	}

	const exportedAt = deps.now().toISOString();
	const envelope: ExportEnvelope = {
		exportedAt,
		articleCount: articles.length,
		articles,
	};
	const body = JSON.stringify(envelope, null, 2);

	const { s3Key, downloadUrl } = await deps.uploadUserDataExport({
		userId: detail.userId,
		body,
	});

	await deps.sendEmail({
		from: EMAIL_FROM,
		to: detail.email,
		subject: "Your Readplace export is ready",
		html: buildUserDataExportEmailHtml({
			downloadUrl,
			articleCount: articles.length,
			ttlDays: EXPORT_DOWNLOAD_TTL_DAYS,
		}),
	});

	await deps.publishEvent({
		source: UserDataExportedEvent.source,
		detailType: UserDataExportedEvent.detailType,
		detail: JSON.stringify({
			userId: detail.userId,
			articleCount: articles.length,
			s3Key,
			exportedAt,
		}),
	});

	deps.logger.info("[ExportUserData] export completed", {
		userId: detail.userId,
		articleCount: articles.length,
		s3Key,
	});
}
