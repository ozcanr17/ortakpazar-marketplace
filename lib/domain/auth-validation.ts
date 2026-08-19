import { z } from "zod";

export const passwordSchema = z.string().min(10).max(128).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/);
export const registerSchema = z.object({ firstName: z.string().min(2).max(80), lastName: z.string().min(2).max(80), email: z.string().email().max(320), password: passwordSchema, legalDocumentIds: z.array(z.string().uuid()).min(2), marketingConsent: z.boolean().default(false) });
