import Handlebars from 'handlebars';

export function render(template: string, data: object): string {
  const compiled = Handlebars.compile(template);
  return compiled(data);
}
