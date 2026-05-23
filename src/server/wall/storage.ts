import { Redis } from '@upstash/redis';
import { requireEnv } from './config';
import { toPublicNote } from './types';
import type { Note, NoteStatus, PublicNote, Topic } from './types';

// Upstash Redis is a stateless REST client (no connection pool), so a fresh
// instance per call is cheap and avoids shared mutable state.
export function getRedis(): Redis {
  return new Redis({
    url: requireEnv('UPSTASH_REDIS_REST_URL'),
    token: requireEnv('UPSTASH_REDIS_REST_TOKEN'),
  });
}

const KEY = {
  note: (id: string) => `wall:note:${id}`,
  approved: 'wall:approved',
  pending: 'wall:pending',
  rejected: 'wall:rejected',
  audit: 'wall:audit',
  dailyModerations: (day: string) => `wall:moderations:${day}`,
};

function setKeyForStatus(status: NoteStatus): string | null {
  switch (status) {
    case 'approved':
      return KEY.approved;
    case 'pending':
      return KEY.pending;
    case 'rejected':
      return KEY.rejected;
    default:
      return null; // deleted lives in no set
  }
}

// Upstash auto-JSON-parses hash values on read, so a body of "42" could come
// back as a number. Coerce every field explicitly to keep types honest.
function rowToNote(row: Record<string, unknown> | null): Note | null {
  if (!row || Object.keys(row).length === 0) return null;
  const str = (v: unknown): string => (v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v));
  return {
    id: str(row.id),
    name: str(row.name),
    topic: str(row.topic) as Topic,
    body: str(row.body),
    createdAt: str(row.createdAt),
    status: str(row.status) as NoteStatus,
    verdict: str(row.verdict),
    confidence: Number(row.confidence ?? 0),
    reason: str(row.reason),
    deletedAt: row.deletedAt ? str(row.deletedAt) : undefined,
  };
}

function noteToRow(note: Note): Record<string, string | number> {
  const row: Record<string, string | number> = {
    id: note.id,
    name: note.name,
    topic: note.topic,
    body: note.body,
    createdAt: note.createdAt,
    status: note.status,
    verdict: note.verdict,
    confidence: note.confidence,
    reason: note.reason,
  };
  if (note.deletedAt) row.deletedAt = note.deletedAt;
  return row;
}

export async function createNote(note: Note): Promise<void> {
  const redis = getRedis();
  const score = new Date(note.createdAt).getTime();
  await redis.hset(KEY.note(note.id), noteToRow(note));
  const setKey = setKeyForStatus(note.status);
  if (setKey) await redis.zadd(setKey, { score, member: note.id });
}

export async function getNote(id: string): Promise<Note | null> {
  const row = await getRedis().hgetall(KEY.note(id));
  return rowToNote(row as Record<string, unknown> | null);
}

async function getNotesFromSet(setKey: string, limit: number): Promise<Note[]> {
  const redis = getRedis();
  const ids = (await redis.zrange(setKey, 0, limit - 1, { rev: true })) as string[];
  if (!ids.length) return [];
  const pipeline = redis.pipeline();
  ids.forEach((id) => pipeline.hgetall(KEY.note(id)));
  const rows = (await pipeline.exec()) as (Record<string, unknown> | null)[];
  return rows.map(rowToNote).filter((n): n is Note => n !== null);
}

// Public wall — only ever reads the approved set, never sees other states.
export async function getApprovedNotes({ limit = 100 }: { limit?: number } = {}): Promise<PublicNote[]> {
  const notes = await getNotesFromSet(KEY.approved, limit);
  return notes.filter((n) => n.status === 'approved').map(toPublicNote);
}

// Admin/phase-3 surfaces — full records, moderation internals included.
export async function getPendingNotes({ limit = 100 }: { limit?: number } = {}): Promise<Note[]> {
  return getNotesFromSet(KEY.pending, limit);
}

export async function getRejectedNotes({ limit = 100 }: { limit?: number } = {}): Promise<Note[]> {
  return getNotesFromSet(KEY.rejected, limit);
}

export async function updateNoteStatus(id: string, newStatus: NoteStatus): Promise<Note | null> {
  const redis = getRedis();
  const note = await getNote(id);
  if (!note) return null;

  const oldSet = setKeyForStatus(note.status);
  if (oldSet) await redis.zrem(oldSet, id);

  const newSet = setKeyForStatus(newStatus);
  if (newSet) {
    // Rejections are scored by decision time; others keep submission order.
    const score = newStatus === 'rejected' ? Date.now() : new Date(note.createdAt).getTime();
    await redis.zadd(newSet, { score, member: id });
  }

  await redis.hset(KEY.note(id), { status: newStatus });
  return { ...note, status: newStatus };
}

export async function softDeleteNote(id: string): Promise<Note | null> {
  const redis = getRedis();
  const note = await getNote(id);
  if (!note) return null;

  const oldSet = setKeyForStatus(note.status);
  if (oldSet) await redis.zrem(oldSet, id);

  const deletedAt = new Date().toISOString();
  await redis.hset(KEY.note(id), { status: 'deleted', deletedAt });
  return { ...note, status: 'deleted', deletedAt };
}

export async function appendAudit(entry: Record<string, unknown>): Promise<void> {
  await getRedis().rpush(KEY.audit, JSON.stringify(entry));
}

// Daily moderation counter for the cost cap. TTL just past 24h so it self-clears.
export async function getDailyModerations(): Promise<number> {
  const day = new Date().toISOString().slice(0, 10);
  return (await getRedis().get<number>(KEY.dailyModerations(day))) ?? 0;
}

export async function incrementDailyModerations(): Promise<number> {
  const redis = getRedis();
  const day = new Date().toISOString().slice(0, 10);
  const key = KEY.dailyModerations(day);
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 60 * 60 * 26);
  return count;
}
