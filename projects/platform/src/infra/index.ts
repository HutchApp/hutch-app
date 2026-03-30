import type * as pulumi from "@pulumi/pulumi";
import { HutchEventBus } from "@packages/hutch-event-bridge/infra";

const eventBus = new HutchEventBus("hutch");

export const hutchEventBusName: pulumi.Output<string> = eventBus.eventBusName;
export const hutchEventBusArn: pulumi.Output<string> = eventBus.eventBusArn;
