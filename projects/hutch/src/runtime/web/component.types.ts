export interface ParsedComponent {
  statusCode: number;
  body: string;
}

export type SupportedMediaType = 'text/html' | 'application/vnd.siren+json';

export type Component = {
  to: (mediaType: SupportedMediaType) => ParsedComponent;
};

export function HtmlPage(body: string): Component {
  return {
    to: (mediaType) => {
      if (mediaType !== 'text/html') {
        return { statusCode: 415, body: '' };
      }
      return { statusCode: 200, body };
    },
  };
}
