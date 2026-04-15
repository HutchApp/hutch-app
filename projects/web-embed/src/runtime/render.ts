import Handlebars from "handlebars";

const compiled = new Map<string, HandlebarsTemplateDelegate>();

export function render(template: string, data: object): string {
	let fn = compiled.get(template);
	if (!fn) {
		fn = Handlebars.compile(template);
		compiled.set(template, fn);
	}
	return fn(data);
}
