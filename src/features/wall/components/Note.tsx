import type { PublicNote } from '@/server/wall/types';

export interface NotePosition {
  x: number;
  y: number;
  rotate: number;
  zIndex: number;
}

interface NoteProps {
  note: PublicNote;
  position: NotePosition;
  dragging: boolean;
  onPointerDown: (event: PointerEvent, id: string) => void;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function Note({ note, position, dragging, onPointerDown }: NoteProps) {
  const style = {
    left: `${position.x}px`,
    top: `${position.y}px`,
    transform: `rotate(${position.rotate}deg)`,
    zIndex: position.zIndex,
  };

  return (
    <div
      class={`wall-note${dragging ? ' is-dragging' : ''}`}
      data-topic={note.topic}
      style={style}
      onPointerDown={(event) => onPointerDown(event, note.id)}
    >
      <div class="wall-note__head">
        <span class="wall-note__name">{note.name || 'anon'}</span>
        <span class="wall-note__topic">{note.topic}</span>
      </div>
      <p class="wall-note__body">{note.body}</p>
      <time class="wall-note__time" dateTime={note.createdAt}>
        {relativeTime(note.createdAt)}
      </time>
    </div>
  );
}
