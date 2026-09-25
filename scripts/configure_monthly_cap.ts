import { z } from "zod";
import { InfraiControlClient, InfraiError } from "../src/infrai_control.js";

const EnvironmentSchema = z.object({
  INFRAI_API_KEY: z.string().min(1),
  MONTHLY_HARD_CAP_USD: z.coerce.number().positive(),
});

const environment = EnvironmentSchema.parse(process.env);
const control = new InfraiControlClient(environment.INFRAI_API_KEY);

try {
  const budget = await control.setMonthlyBudget(environment.MONTHLY_HARD_CAP_USD);
  console.log("Monthly hard cap configured", budget);
} catch (error) {
  if (error instanceof InfraiError) {
    console.error(`Budget request rejected (${error.status}): ${error.message}`);
    process.exitCode = error.status >= 400 && error.status < 500 ? 2 : 1;
  } else {
    throw error;
  }
}
