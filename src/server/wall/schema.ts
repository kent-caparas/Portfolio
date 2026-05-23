// zod/v4 to match the module instance the SDK's zodOutputFormat helper uses.
import { z } from 'zod/v4';
import { TOPICS } from './types';

export const SubmissionSchema = z.object({
  name: z.string().trim().max(40, 'Name must be 40 characters or fewer.').default(''),
  topic: z.enum(TOPICS),
  body: z
    .string()
    .trim()
    .min(1, 'Say something.')
    .max(280, 'Notes are limited to 280 characters.'),
});

export type SubmissionInput = z.infer<typeof SubmissionSchema>;

// Claude's moderation response must match this exactly, or we default to pending.
export const ModerationResultSchema = z.object({
  verdict: z.enum(['approve', 'flag']),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1).max(400),
});
