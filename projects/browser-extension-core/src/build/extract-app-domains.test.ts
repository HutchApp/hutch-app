import { extractAppDomainsFromPulumiYaml } from "./extract-app-domains";

describe("extractAppDomainsFromPulumiYaml", () => {
	it("extracts a single domain", () => {
		const yaml = `config:
  hutch:domains:
    - domainA.com
  hutch:deletionProtection: true`;
		expect(extractAppDomainsFromPulumiYaml(yaml)).toEqual(["domainA.com"]);
	});

	it("extracts multiple domains in order", () => {
		const yaml = `config:
  hutch:domains:
    - domainA.com
    - domainB.com
  hutch:deletionProtection: true`;
		expect(extractAppDomainsFromPulumiYaml(yaml)).toEqual(["domainA.com", "domainB.com"]);
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
    - domainA.com
  hutch:redirectDomains:
    - domainC`;
		expect(extractAppDomainsFromPulumiYaml(yaml)).toEqual(["domainA.com"]);
	});

	it("strips surrounding double quotes", () => {
		const yaml = `config:
  hutch:domains:
    - "domainA.com"`;
		expect(extractAppDomainsFromPulumiYaml(yaml)).toEqual(["domainA.com"]);
	});

	it("strips surrounding single quotes", () => {
		const yaml = `config:
  hutch:domains:
    - 'domainA.com'`;
		expect(extractAppDomainsFromPulumiYaml(yaml)).toEqual(["domainA.com"]);
	});

	it("ignores blank lines inside the list", () => {
		const yaml = `config:
  hutch:domains:
    - domainA.com

    - domainB.com
  hutch:deletionProtection: true`;
		expect(extractAppDomainsFromPulumiYaml(yaml)).toEqual(["domainA.com", "domainB.com"]);
	});

	it("returns empty array for empty input", () => {
		expect(extractAppDomainsFromPulumiYaml("")).toEqual([]);
	});
});
