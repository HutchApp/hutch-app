export interface ParsedComponent {
  statusCode: number;
  body: string;
}

export type SupportedMediaType = 'text/html' | 'application/vnd.siren+json';

export type Component = {
  to: (mediaType: SupportedMediaType) => ParsedComponent;
};
