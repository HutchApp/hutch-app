interface ParsedComponent {
  statusCode: number;
  body: string;
}

type SupportedMediaType = 'text/html';

export type Component = {
  to: (mediaType: SupportedMediaType) => ParsedComponent;
};
