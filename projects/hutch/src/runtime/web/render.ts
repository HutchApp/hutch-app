import Handlebars from 'handlebars';

const compiledTemplates = new Map<string, HandlebarsTemplateDelegate>();

export function render(template: string, data: object): string {
  let compiled = compiledTemplates.get(template);
  if (!compiled) {
    compiled = Handlebars.compile(template);
    compiledTemplates.set(template, compiled);
  }
  return compiled(data);
}
