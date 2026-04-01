import * as pulumi from "@pulumi/pulumi";
import { HutchEventBus } from "@packages/hutch-infra-components/infra";

const config = new pulumi.Config();
const eventBusName = config.require("eventBusName");

const eventBus = HutchEventBus.create("hutch", { eventBusName });

export const hutchEventBusName = eventBus.eventBusName;
export const hutchEventBusArn = eventBus.eventBusArn;
