import type { PublicNote } from '@/server/wall/types';
import { relativeTime } from '@/lib/relative-time';

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
