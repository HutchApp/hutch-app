export interface ParsedComponent {
	statusCode: number;
	body: string;
}

export type SupportedMediaType = "text/html";

export type Component = {
	to: (mediaType: SupportedMediaType) => ParsedComponent;
};
