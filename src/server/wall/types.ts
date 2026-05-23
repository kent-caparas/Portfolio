export const TOPICS = ['feedback', 'idea', 'collab', 'hello'] as const;
export type Topic = (typeof TOPICS)[number];

export type NoteStatus = 'approved' | 'pending' | 'rejected' | 'deleted';

export type ModerationVerdict = 'approve' | 'flag';

export interface ModerationResult {
  verdict: ModerationVerdict;
  confidence: number;
  reason: string;
}

export interface Submission {
  name: string;
  topic: Topic;
  body: string;
}

// Full record as stored in Redis.
export interface Note {
  id: string;
  name: string;
  topic: Topic;
  body: string;
  createdAt: string; // ISO 8601
  status: NoteStatus;
  verdict: string; // JSON string of the moderation result
  confidence: number;
  reason: string;
  deletedAt?: string;
}

// What the public wall and client ever see — no moderation internals.
export interface PublicNote {
  id: string;
  name: string;
  topic: Topic;
  body: string;
  createdAt: string;
}

export function toPublicNote(note: Note): PublicNote {
  return {
    id: note.id,
    name: note.name,
    topic: note.topic,
    body: note.body,
    createdAt: note.createdAt,
  };
}
