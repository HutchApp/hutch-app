import * as pulumi from "@pulumi/pulumi";
import { HutchEventBus } from "@packages/hutch-event-bridge/infra";

const config = new pulumi.Config();
const eventBusName = config.require("eventBusName");

const eventBus = new HutchEventBus("platform", { eventBusName });

export const hutchEventBusName = eventBus.eventBusName;
export const hutchEventBusArn = eventBus.eventBusArn;
