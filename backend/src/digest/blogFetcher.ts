import axios from 'axios';
import * as cheerio from 'cheerio';

const BLOG_URL = 'https://www.oasis.security/blog';

export interface BlogPost {
  title: string;
  url: string;
  slug: string;
  content: string;
}

export function toJiraLabelSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function fetchLatestBlogPost(): Promise<BlogPost> {
  const listingRes = await axios.get<string>(BLOG_URL);
  const $ = cheerio.load(listingRes.data);

  const postAnchor = $('a[href*="/blog/"]')
    .filter((_i, el) => {
      const href = $(el).attr('href') ?? '';
      return href !== '/blog' && href !== '/blog/' && href !== BLOG_URL;
    })
    .first();

  const href = postAnchor.attr('href') ?? '';
  if (!href) throw new Error('No blog post link found on oasis.security/blog');

  const url = href.startsWith('http') ? href : `https://www.oasis.security${href}`;
  const rawSlug = url.split('/').filter(Boolean).pop() ?? '';
  const slug = toJiraLabelSlug(rawSlug);

  const title = postAnchor.find('h3').first().text().trim();
  const excerpt = postAnchor.find('[class*="text-size-regular"]').first().text().trim();
  const content = excerpt || postAnchor.text().trim();

  return { title, url, slug, content };
}
