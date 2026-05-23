import type { APIRoute } from 'astro';
import { nanoid } from 'nanoid';
import { SubmissionSchema } from '@/server/wall/schema';
import { screen, normalizeWhitespace } from '@/server/wall/validate';
import { checkRateLimit } from '@/server/wall/rate-limit';
import { moderate, statusForVerdict } from '@/server/wall/moderate';
import {
  createNote,
  getDailyModerations,
  incrementDailyModerations,
} from '@/server/wall/storage';
import { audit } from '@/server/wall/audit';
import { notifySlack } from '@/server/wall/slack';
import { config } from '@/server/wall/config';
import type { ModerationResult, Note } from '@/server/wall/types';

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  // 1. Parse JSON.
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON body.' }, 400);
  }

  // 2. Validate shape + lengths.
  const parsed = SubmissionSchema.safeParse(raw);
  if (!parsed.success) {
    const error = parsed.error.issues[0]?.message ?? 'Invalid submission.';
    return json({ ok: false, error }, 400);
  }

  // 3. Reject HTML and obvious injection before spending anything.
  const screened = screen({ name: parsed.data.name, body: parsed.data.body });
  if (!screened.ok) {
    return json({ ok: false, error: screened.reason }, 422);
  }

  // 4. Rate-limit by IP (before moderation — don't pay for spam).
  const ip = clientAddress ?? 'unknown';
  const rate = await checkRateLimit(ip);
  if (!rate.success) {
    return json(
      { ok: false, error: 'Slow down — you have hit the hourly limit. Try again later.' },
      429,
    );
  }

  // 5. Sanitize (normalize whitespace; HTML already rejected above).
  const submission = {
    name: normalizeWhitespace(parsed.data.name),
    topic: parsed.data.topic,
    body: normalizeWhitespace(parsed.data.body),
  };

  // 6. Moderate — unless the daily cost cap is hit, in which case skip the call
  //    and route to pending (a failed/absent moderation never auto-approves).
  let result: ModerationResult;
  let moderated: boolean;
  const used = await getDailyModerations();
  if (used >= config.dailyMaxModerations) {
    result = { verdict: 'flag', confidence: 0, reason: 'daily_cap_reached' };
    moderated = false;
  } else {
    await incrementDailyModerations();
    const outcome = await moderate(submission);
    result = outcome.result;
    moderated = outcome.ok;
  }

  // 7. Decide bucket and persist.
  const status = statusForVerdict(result, config.publicResults);
  const note: Note = {
    id: nanoid(12),
    name: submission.name,
    topic: submission.topic,
    body: submission.body,
    createdAt: new Date().toISOString(),
    status,
    verdict: JSON.stringify(result),
    confidence: result.confidence,
    reason: result.reason,
  };
  await createNote(note);

  // 8. Audit, then phase-3 Slack hook (fire-and-forget no-op for now).
  await audit({
    actor: 'system',
    action: 'submit',
    noteId: note.id,
    after: { status, verdict: result.verdict, confidence: result.confidence, moderated },
  });
  void notifySlack(note, result).catch(() => {});

  // 9. Never reveal an auto-rejection to the submitter — report it as pending so
  //    bad actors can't iterate against the moderator.
  const clientStatus = status === 'approved' ? 'approved' : 'pending';
  return json({ ok: true, status: clientStatus, noteId: note.id });
};
