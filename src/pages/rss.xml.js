import rss from '@astrojs/rss';
import { getPublishedPosts, formatTag } from '@/features/blog/lib/posts';

export async function GET(context) {
  const posts = await getPublishedPosts();

  return rss({
    title: 'Kent Caparas, writing',
    description:
      'Notes from deploying AI with real teams, the things I build, and whatever I learned this week.',
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.date,
      description: post.data.excerpt,
      categories: [formatTag(post.data.tag)],
      link: `/blog/${post.id}/`,
    })),
    customData: '<language>en-us</language>',
  });
}
