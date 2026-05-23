import type { ModerationResult, Note } from './types';

// Phase 3 replaces this body with the real Slack notification (interactive
// approve/reject buttons posted to a private channel). For phase 2 it's a
// deliberate no-op so the submit handler can already call it fire-and-forget.
export async function notifySlack(_note: Note, _verdict: ModerationResult): Promise<void> {
  return;
}
