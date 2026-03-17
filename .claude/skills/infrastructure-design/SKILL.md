# Infrastructure Design

## Data-Driven Over Environment Conditionals

Infrastructure code must not branch on environment names (e.g., `if (stage === "production")`). Instead, express environment differences as configuration values in each environment's YAML file and read them with Pulumi's config API.

```typescript
// BAD - Branching on environment name
const isProduction = stage === "production";
const storage = new HutchStorage("hutch", {
    deletionProtection: isProduction,
});
const domainRegistration = isProduction
    ? new DomainRegistration("hutch-domain", { domains: ["hutch-app.com"] })
    : undefined;

// GOOD - Config-driven, no environment conditionals
const deletionProtection = config.requireBoolean("deletionProtection");
const domains = config.getObject<string[]>("domains") ?? [];
const storage = new HutchStorage("hutch", { deletionProtection });
const domainRegistration = new DomainRegistration("hutch-domain", { domains });
```

Each environment YAML declares its own values:

```yaml
# Pulumi.prod.yaml
config:
  hutch:domains:
    - hutch-app.com
  hutch:deletionProtection: true

# Pulumi.staging.yaml
config:
  hutch:deletionProtection: false
  # no domains — DomainRegistration is a no-op internally
```

**Why:** Environment conditionals scatter knowledge about what differs between environments across the codebase. Config-driven infrastructure keeps that knowledge in the YAML files where it belongs — adding a new environment means adding a YAML file, not editing code.

## When to Use `require` vs `get`

| Method | Use when |
|--------|----------|
| `config.require` / `config.requireBoolean` | The value must be set in every environment |
| `config.getObject` / `config.get` | The value is optional and absence is meaningful (e.g., empty domains = no custom domain) |
