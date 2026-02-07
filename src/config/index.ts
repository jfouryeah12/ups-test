import "dotenv/config";
import { z } from "zod";

const ConfigSchema = z.object({
  UPS_CLIENT_ID: z.string().min(1),
  UPS_CLIENT_SECRET: z.string().min(1),
  UPS_BASE_URL: z.string().url(),
  UPS_OAUTH_URL: z.string().url(),
  HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
});

export const config = ConfigSchema.parse(process.env);
