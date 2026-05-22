import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

const isVisible = (post: Post): boolean =>
  import.meta.env.PROD ? !post.data.draft : true;

/** All visible posts, newest first. Drafts are hidden in production builds. */
export async function getPublishedPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', isVisible);
  return posts.sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  );
}

/** The N most recent posts for the home page log. */
export async function getRecentPosts(limit = 4): Promise<Post[]> {
  return (await getPublishedPosts()).slice(0, limit);
}

/** Format a date as the mono system timestamp: 2026.05.14 */
export function formatStamp(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

/** Human label for a tag enum value, e.g. "patch-notes" -> "patch notes". */
export function formatTag(tag: Post['data']['tag']): string {
  return tag.replace(/-/g, ' ');
}
