/**
 * Effects a transition produces alongside the post-state aggregate. The
 * orchestrator dispatches these AFTER the storage write succeeds; if the
 * dispatcher throws, the handler throws and SQS redelivers, at which point
 * the redelivered invocation reloads the (now-persisted) aggregate, sees the
 * transition is already applied, and re-emits the effects. Consumers
 * de-duplicate via EventBridge's existing at-least-once semantics — there is
 * no new idempotency contract for Phase 1.
 *
 * Each variant carries the minimum payload its existing wire format requires;
 * the dispatcher adapter is responsible for mapping a variant to the
 * corresponding `defineEvent`/`defineCommand` envelope at the EventBridge or
 * SQS boundary.
 */

export type Effect =
	| { kind: "DispatchGenerateSummaryCommand"; url: string }
	| { kind: "PublishRecrawlLinkInitiatedEvent"; url: string };

export type DispatchEffects = (effects: readonly Effect[]) => Promise<void>;
