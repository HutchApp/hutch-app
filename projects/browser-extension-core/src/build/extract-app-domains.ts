import { load } from "js-yaml";
import { z } from "zod";

const PulumiStackSchema = z.object({
	config: z
		.object({
			"hutch:domains": z.array(z.string()).optional(),
		})
		.optional(),
});

export function extractAppDomainsFromPulumiYaml(yamlContent: string): string[] {
	const parsed = PulumiStackSchema.parse(load(yamlContent) ?? {});
	return parsed.config?.["hutch:domains"] ?? [];
}
