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

When runtime code requires an environment variable, every link in the chain from source to runtime must be wired up. These concerns are spread across multiple files with no compile-time link — nothing enforces consistency automatically.

Two failure modes to guard against:

1. **Production-only `requireEnv`**: runtime code requires the variable only inside `if (persistence === "prod")`. Local dev takes the in-memory path and skips the call entirely, so the app works locally and tests pass. The missing variable only surfaces when the Lambda initialises in the deployed environment, crashing every request with a 500.
2. **Local env hides CI gap**: `pnpm check-infra` and `pulumi up` pass on your laptop because the variable is set in your shell, but the CI deploy job never receives the secret. `requireEnv` aborts Pulumi at the start of the deploy step with `AssertionError: Environment variable X is required but not set`.

Env vars come in two flavors. Each has a different chain from source to runtime. Trace an existing var of the same flavor end-to-end and replicate the pattern.

### Flavor A — Config-derived (AWS resource names)

For env vars that name a resource you provision in Pulumi (DynamoDB table, S3 bucket, EventBridge bus, etc.), the chain starts in the Pulumi config YAML files.

**Checklist when adding a `requireEnv` call for a config-derived variable:**
- [ ] Config value added to **every** environment YAML file (`Pulumi.prod.yaml`, `Pulumi.staging.yaml`, etc.)
- [ ] Config read in the infrastructure entry point and passed to the resource class
- [ ] Resource created in the infrastructure resource class
- [ ] IAM policy grants the deployed function access to the new resource's ARN
- [ ] Lambda `environment:` block sets the variable, pointing to `resource.name`
- [ ] Runtime composition root reads the variable via `requireEnv` and passes it to the provider

### Flavor B — External secret (API keys, OAuth client secrets, webhook tokens)

For env vars that carry an external credential with no AWS resource backing it (third-party API key, OAuth client secret, webhook signing secret, etc.), the chain starts in GitHub Actions secrets and flows through the reusable CI deploy workflow.

**Checklist when adding a `requireEnv` call for an external-secret variable:**
- [ ] **GitHub Actions secrets** — `gh secret list --env staging --repo <org>/<repo>` and `gh secret list --env prod --repo <org>/<repo>` both show the variable. Secret values must be set via the GitHub UI — they can't be set from `gh` without a PAT with `secrets:write`. If missing, tell the user explicitly before creating the commit.
- [ ] **CI deploy workflow `env:` block** — `.github/workflows/project-deployment.yaml` (or whichever reusable workflow deploys the project) forwards the secret into **both** `deploy-staging` and `deploy-prod` jobs: `VAR_NAME: ${{ secrets.VAR_NAME }}`. **This is the most commonly missed step** — the GitHub secret can exist and still not reach the job unless the workflow forwards it explicitly.
- [ ] Lambda `environment:` block in `projects/*/src/infra/index.ts` sets `VAR_NAME: requireEnv("VAR_NAME")` so the variable reaches the deployed runtime.
- [ ] Runtime composition root reads the variable via `requireEnv` and wires it into the provider.
- [ ] Local `.env` (gitignored, auto-sourced by `.envrc`) has the variable so local dev and `pnpm check-infra` work.

### Don't collide with existing env var names

Before introducing a new env var name, grep for existing use across `.github/workflows/`, `projects/*/src/infra/`, `projects/*/src/runtime/`, and `projects/*/scripts/`. The same name may already be claimed by another project — for example, the Chrome Web Store publishing workflow holds `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` unrelated to any app-side Google login. Namespace collisions fail silently in some layers and at CI-deploy time in others. Namespace new variables to avoid the trap: prefer `GOOGLE_LOGIN_CLIENT_ID` over `GOOGLE_CLIENT_ID` if the existing name is already claimed elsewhere.

## Moving a Domain Between Redirect and Primary Requires Two Deploys

ACM cert validation DNS records conflict when a domain moves between `redirectDomains` and `domains` in the same deploy because Pulumi creates before it deletes. Remove the domain from its old list first, deploy, then add it to the new list.

## Wire-Format Values Are Deployment Contracts

The `source` and `detailType` strings in event definitions are stored in deployed EventBridge rules. Renaming them requires coordinated redeployment of all stacks that publish or subscribe. Change TypeScript identifiers freely, but treat wire values as immutable unless you coordinate the deployment.
