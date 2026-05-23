import { appendAudit } from './storage';

export interface AuditEvent {
  actor: string; // "system" in phase 2; a Slack user id in phase 3
  action: string; // e.g. "submit", "approve", "reject", "delete"
  noteId: string;
  before?: unknown;
  after?: unknown;
}

// Append-only event log. Best-effort: a logging failure must never break a
// submission, so we swallow and console.error instead of throwing.
export async function audit(event: AuditEvent): Promise<void> {
  try {
    await appendAudit({ ts: new Date().toISOString(), ...event });
  } catch (err) {
    console.error('[wall] audit append failed:', err instanceof Error ? err.message : err);
  }
}
