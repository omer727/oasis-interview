import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import { fetchLatestBlogPost } from './blogFetcher';
import { JiraServiceClient } from '../jira/serviceClient';

export async function runBlogDigestJob(): Promise<void> {
  const { claudeApiKey, projectKey } = config.digest;
  if (!claudeApiKey || !projectKey) {
    console.warn('[digest] Skipping: CLAUDE_API_KEY or JIRA_BLOG_DIGEST_PROJECT_KEY not configured');
    return;
  }

  console.log('[digest] Running NHI Blog Digest job...');

  const post = await fetchLatestBlogPost();
  const label = `blog-digest:${post.slug}`;

  const jira = new JiraServiceClient(config.jiraService.email, config.jiraService.token, config.jiraService.baseUrl);
  const exists = await jira.ticketExistsForLabel(label);
  if (exists) {
    console.log(`[digest] Ticket already exists for "${post.title}" — skipping`);
    return;
  }

  const anthropic = new Anthropic({ apiKey: claudeApiKey });
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: `Summarize this blog post in 2-3 sentences:\n\nTitle: ${post.title}\n\n${post.content.slice(0, 8000)}`,
      },
    ],
  });

  const summary = (message.content[0] as { type: 'text'; text: string }).text;

  try {
    const ticketUrl = await jira.createDigestTicket(post.title, summary, projectKey, label);
    console.log(`[digest] Created ticket for "${post.title}": ${ticketUrl}`);
  } catch (err: unknown) {
    const axiosErr = err as { response?: { data?: unknown; status?: number } };
    console.error('[digest] Failed to create ticket:', JSON.stringify(axiosErr?.response?.data ?? err));
    throw err;
  }
}
