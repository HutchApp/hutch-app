---
name: infrastructure-design
description: Infrastructure Design
---

# Infrastructure Design

## Data-Driven Over Environment Conditionals

Infrastructure code must not branch on environment names (e.g., `if (stage === "production")`). Instead, express environment differences as configuration values in each environment's YAML file and read them with Pulumi's config API.

**Why:** Environment conditionals scatter knowledge about what differs between environments across the codebase. Config-driven infrastructure keeps that knowledge in the YAML files where it belongs — adding a new environment means adding a YAML file, not editing code.

## When to Use `require` vs `get`

| Method | Use when |
|--------|----------|
| `config.require` / `config.requireBoolean` | The value must be set in every environment |
| `config.getObject` / `config.get` | The value is optional and absence is meaningful (e.g., empty list = feature disabled) |

## Events vs Commands

An **event** is a fact — something that already happened. Events are named in past tense (`LinkSavedEvent`, `SummaryGeneratedEvent`). Use events when multiple independent consumers may react to the same fact (fan-out).

A **command** is an action request — it can be validated, prevented, or retried. Commands are named in imperative (`GenerateSummaryCommand`). Use commands when exactly one handler must process the action.

## Runtime Environment Must Match Infrastructure

When runtime code requires an environment variable (e.g., a DynamoDB table name), the infrastructure definition must provision the resource, expose it via config, wire the environment variable into the deployed function, and grant IAM access. These concerns are spread across multiple files with no compile-time link — nothing enforces consistency automatically.

A new resource (e.g., a DynamoDB table) must flow through every layer. Follow existing resources of the same kind as a template — trace one end-to-end and replicate the pattern:

1. **Environment YAML files** — Add a config value for the resource name in every environment's YAML
2. **Infrastructure entry point** — Read the config value and pass it to the resource class
3. **Resource class** — Declare and create the resource (table, bucket, etc.)
4. **IAM policies** — Grant the deployed function access to the new resource's ARN
5. **Lambda environment block** — Set the environment variable pointing to the resource name
6. **Runtime composition root** — `requireEnv` reads the variable and passes it to the provider

A common failure mode: runtime code conditionally requires environment variables only in the production code path (e.g., inside `if (persistence === "prod")`). Local development uses an in-memory path that skips those calls entirely, so the app works locally and tests pass. The missing variable only surfaces when the Lambda initialises in the deployed environment, crashing every request with a 500.

**Checklist when adding a `requireEnv` call to the production code path:**
- [ ] Config value added to all environment YAML files
- [ ] Config read in infrastructure entry point and passed to resource class
- [ ] Resource created in the infrastructure resource class
- [ ] IAM policy grants access to the new resource
- [ ] Environment variable set in the Lambda environment block
- [ ] Runtime composition root reads the env var and wires it to the provider

## Wire-Format Values Are Deployment Contracts

The `source` and `detailType` strings in event definitions are stored in deployed EventBridge rules. Renaming them requires coordinated redeployment of all stacks that publish or subscribe. Change TypeScript identifiers freely, but treat wire values as immutable unless you coordinate the deployment.
