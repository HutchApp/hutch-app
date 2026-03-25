import { z } from "zod";
import type { FeatureId } from "./feature-vote.types";

export const FeatureIdSchema = z.string().transform((s): FeatureId => s as FeatureId);
