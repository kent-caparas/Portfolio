export type BoardKind = 'photo' | 'about' | 'post' | 'project' | 'link' | 'invite' | 'visitor';

export interface BoardImage {
  src: string;
  srcset: string;
  alt: string;
}

export interface BoardItem {
  id: string;
  kind: BoardKind;
  /** label on the globe. Items with a word fall from it. */
  word?: string;
  /** small label in the note head */
  label: string;
  /** small text on the right of the head */
  meta?: string;
  title?: string;
  body?: string;
  href?: string;
  image?: BoardImage;
  /** ISO date, visitor notes only */
  createdAt?: string;
  /** paper color, visitor notes only */
  topic?: string;
}

const EMAIL = 'kentcaparas12@gmail.com';
const GITHUB = 'https://github.com/kent-caparas';

/** Lines from the hello world post, trimmed. */
export const ABOUT_NOTES: BoardItem[] = [
  {
    id: 'about-use-cases',
    kind: 'about',
    word: 'use cases',
    label: 'kent',
    meta: 'about',
    body: 'i love building things. use cases excite me.',
  },
  {
    id: 'about-shy',
    kind: 'about',
    word: 'shy',
    label: 'kent',
    meta: 'about',
    body: 'someone who could be unhinged, and at the same time exceptionally shy.',
  },
  {
    id: 'about-desk',
    kind: 'about',
    word: 'desk',
    label: 'kent',
    meta: 'about',
    body: "touching grass helps. it doesn't keep me away from my desk.",
  },
];

export const LINK_NOTES: BoardItem[] = [
  {
    id: 'link-github',
    kind: 'link',
    word: 'github',
    label: 'github',
    meta: 'link',
    body: 'kent-caparas',
    href: GITHUB,
  },
  {
    id: 'link-email',
    kind: 'link',
    word: 'email',
    label: 'email',
    meta: 'link',
    body: EMAIL,
    href: `mailto:${EMAIL}`,
  },
  {
    id: 'invite',
    kind: 'invite',
    word: 'say hi',
    label: '+ leave a note',
    body: 'ask anything, or share something you learned.',
    href: '/wall',
  },
];
