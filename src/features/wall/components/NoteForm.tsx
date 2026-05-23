import { useState } from 'preact/hooks';
import { TOPICS, type Topic } from '@/server/wall/types';

const BODY_MAX = 280;
const NAME_MAX = 40;
const SUBMIT_TIMEOUT_MS = 8000;

export interface SubmittedNote {
  status: 'approved' | 'pending';
  noteId: string;
  name: string;
  topic: Topic;
  body: string;
}

interface NoteFormProps {
  onSubmitted: (note: SubmittedNote) => void;
}

type StatusKind = 'ok' | 'pending' | 'error';

export default function NoteForm({ onSubmitted }: NoteFormProps) {
  const [name, setName] = useState('');
  const [topic, setTopic] = useState<Topic>('feedback');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ kind: StatusKind; text: string } | null>(null);

  const over = body.length > BODY_MAX;
  const canSubmit = body.trim().length > 0 && !over && !submitting;

  async function handleSubmit(event: Event) {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setStatus(null);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);

    try {
      const res = await fetch('/api/wall/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, topic, body }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        setStatus({ kind: 'error', text: data.error ?? 'Something went wrong. Try again.' });
        return;
      }

      if (data.status === 'approved') {
        setStatus({ kind: 'ok', text: 'your note is up.' });
        onSubmitted({ status: 'approved', noteId: data.noteId, name, topic, body });
      } else {
        setStatus({
          kind: 'pending',
          text: 'thanks — your note is being reviewed before it appears.',
        });
      }
      setBody('');
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === 'AbortError';
      setStatus({
        kind: 'error',
        text: aborted ? 'that took too long. try again.' : 'something went wrong. try again.',
      });
    } finally {
      clearTimeout(timer);
      setSubmitting(false);
    }
  }

  return (
    <form class="wall-form" onSubmit={handleSubmit} novalidate>
      <div class="wall-form__row">
        <label class="wall-form__field">
          <span class="wall-form__label">name (optional)</span>
          <input
            type="text"
            value={name}
            maxLength={NAME_MAX}
            placeholder="anon"
            autoComplete="off"
            onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)}
          />
        </label>
        <label class="wall-form__field" style={{ flex: '0 0 140px' }}>
          <span class="wall-form__label">topic</span>
          <select
            value={topic}
            onChange={(e) => setTopic((e.currentTarget as HTMLSelectElement).value as Topic)}
          >
            {TOPICS.map((t) => (
              <option value={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>

      <div class="wall-form__field" style={{ marginBottom: '12px' }}>
        <span class="wall-form__label">your note</span>
        <textarea
          value={body}
          placeholder="tell me something. ask anything. propose a collab."
          onInput={(e) => setBody((e.currentTarget as HTMLTextAreaElement).value)}
        />
      </div>

      <div class="wall-form__foot">
        <span class="wall-form__count" data-over={over}>
          {body.length}/{BODY_MAX}
        </span>
        <button class="wall-btn" type="submit" disabled={!canSubmit}>
          {submitting ? 'sending…' : 'pin it up'}
        </button>
      </div>

      {status && (
        <div class="wall-status" data-kind={status.kind} role="status">
          {status.text}
        </div>
      )}

      <p class="wall-privacy">
        submissions are stored and reviewed before appearing publicly.
      </p>
    </form>
  );
}
