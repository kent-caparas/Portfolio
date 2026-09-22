import type { BoardItem, BoardKind } from '../lib/board-items';
import { relativeTime } from '@/lib/relative-time';
import NotePin from './NotePin';

interface Props {
  item: BoardItem;
  noteRef: (el: HTMLElement | null) => void;
  onPointerDown: (event: PointerEvent) => void;
  onClick: (event: MouseEvent) => void;
}

interface BodyProps {
  item: BoardItem;
}

// reuses the wall's paper colors
const TOPIC: Record<BoardKind, string> = {
  photo: 'photo',
  about: 'hello',
  post: 'idea',
  project: 'feedback',
  link: 'collab',
  invite: 'invite',
  visitor: 'hello',
};

function Head({ item }: BodyProps) {
  return (
    <div class="wall-note__head">
      <span class="wall-note__name">{item.label}</span>
      {item.meta && <span class="wall-note__topic">{item.meta}</span>}
    </div>
  );
}

function PhotoBody({ item }: BodyProps) {
  if (!item.image) return null;
  return (
    <>
      <img src={item.image.src} srcset={item.image.srcset} sizes="240px" alt={item.image.alt} draggable={false} />
      <span class="board-note__caption">{item.label}</span>
    </>
  );
}

// addresses wrap at the @ on narrow notes instead of mid word
function breakAtSign(text = '') {
  const at = text.indexOf('@');
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <wbr />
      {text.slice(at)}
    </>
  );
}

function TextBody({ item }: BodyProps) {
  return (
    <>
      <Head item={item} />
      <p class="wall-note__body">{breakAtSign(item.body)}</p>
      {item.createdAt && (
        <time class="wall-note__time" dateTime={item.createdAt}>
          {relativeTime(item.createdAt)}
        </time>
      )}
    </>
  );
}

function EntryBody({ item }: BodyProps) {
  return (
    <>
      <Head item={item} />
      <p class="board-note__title">{item.title}</p>
      {item.body && <p class="wall-note__body">{breakAtSign(item.body)}</p>}
    </>
  );
}

function InviteBody({ item }: BodyProps) {
  return (
    <>
      <span class="wall-note--new__label">{item.label}</span>
      <span class="wall-note--new__hint">{item.body}</span>
    </>
  );
}

const BODIES: Record<BoardKind, (props: BodyProps) => preact.JSX.Element | null> = {
  photo: PhotoBody,
  about: TextBody,
  link: TextBody,
  visitor: TextBody,
  post: EntryBody,
  project: EntryBody,
  invite: InviteBody,
};

// outside links open in a new tab
function linkAttrs(href: string): Record<string, string> {
  if (href.startsWith('http')) return { target: '_blank', rel: 'noopener' };
  return {};
}

function noteClass(kind: BoardKind): string {
  if (kind === 'photo') return 'wall-note board-note board-note--photo';
  if (kind === 'invite') return 'wall-note wall-note--new board-note';
  return 'wall-note board-note';
}

export default function BoardNote({ item, noteRef, onPointerDown, onClick }: Props) {
  const Body = BODIES[item.kind];
  const shared = {
    id: `note-${item.id}`,
    class: noteClass(item.kind),
    'data-topic': item.topic ?? TOPIC[item.kind],
    ref: noteRef,
    onPointerDown,
    onClick,
  };

  if (!item.href) {
    return (
      <div {...shared}>
        {item.pinned && <NotePin />}
        <Body item={item} />
      </div>
    );
  }

  return (
    <a {...shared} {...linkAttrs(item.href)} href={item.href} draggable={false}>
      {item.pinned && <NotePin />}
      <Body item={item} />
    </a>
  );
}
