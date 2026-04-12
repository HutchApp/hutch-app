import { extractAppDomainsFromPulumiYaml } from "./extract-app-domains";

describe("extractAppDomainsFromPulumiYaml", () => {
	it("extracts a single domain", () => {
		const yaml = `config:
  hutch:domains:
    - readplace.com
  hutch:deletionProtection: true`;
		expect(extractAppDomainsFromPulumiYaml(yaml)).toEqual(["readplace.com"]);
	});

	it("extracts multiple domains in order", () => {
		const yaml = `config:
  hutch:domains:
    - readplace.com
    - hutch-app.com
  hutch:deletionProtection: true`;
		expect(extractAppDomainsFromPulumiYaml(yaml)).toEqual(["readplace.com", "hutch-app.com"]);
	});

	it("returns empty array when hutch:domains is absent", () => {
		const yaml = `config:
  hutch:deletionProtection: false
  hutch:staticDomains:
    - static.example.com`;
		expect(extractAppDomainsFromPulumiYaml(yaml)).toEqual([]);
	});

	it("stops at the next top-level key", () => {
		const yaml = `config:
  hutch:domains:
    - readplace.com
  hutch:redirectDomains:
    - savearticles.app`;
		expect(extractAppDomainsFromPulumiYaml(yaml)).toEqual(["readplace.com"]);
	});

	it("strips surrounding double quotes", () => {
		const yaml = `config:
  hutch:domains:
    - "readplace.com"`;
		expect(extractAppDomainsFromPulumiYaml(yaml)).toEqual(["readplace.com"]);
	});

	it("strips surrounding single quotes", () => {
		const yaml = `config:
  hutch:domains:
    - 'readplace.com'`;
		expect(extractAppDomainsFromPulumiYaml(yaml)).toEqual(["readplace.com"]);
	});

	it("ignores blank lines inside the list", () => {
		const yaml = `config:
  hutch:domains:
    - readplace.com

    - hutch-app.com
  hutch:deletionProtection: true`;
		expect(extractAppDomainsFromPulumiYaml(yaml)).toEqual(["readplace.com", "hutch-app.com"]);
	});

	it("returns empty array for empty input", () => {
		expect(extractAppDomainsFromPulumiYaml("")).toEqual([]);
	});
});
