import type { Component } from "./component.types";

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
