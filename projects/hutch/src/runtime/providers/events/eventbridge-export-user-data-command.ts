/* c8 ignore start -- thin SDK wrapper, only used in prod path */
import type { PublishEvent } from "@packages/hutch-infra-components/runtime";
import { ExportUserDataCommand } from "@packages/hutch-infra-components";
import type { PublishExportUserDataCommand } from "./publish-export-user-data-command.types";

export function initEventBridgeExportUserDataCommand(deps: {
	publishEvent: PublishEvent;
}): { publishExportUserDataCommand: PublishExportUserDataCommand } {
	const { publishEvent } = deps;

	const publishExportUserDataCommand: PublishExportUserDataCommand = async (params) => {
		await publishEvent({
			source: ExportUserDataCommand.source,
			detailType: ExportUserDataCommand.detailType,
			detail: JSON.stringify({
				userId: params.userId,
				email: params.email,
				requestedAt: params.requestedAt,
			}),
		});
	};

	return { publishExportUserDataCommand };
}
/* c8 ignore stop */
