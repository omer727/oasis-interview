import { runBlogDigestJob } from '../digest/job';
import { fetchLatestBlogPost } from '../digest/blogFetcher';
import { JiraServiceClient } from '../jira/serviceClient';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';

jest.mock('../config', () => ({
  config: {
    digest: { claudeApiKey: 'test-claude-key', projectKey: 'IDENTITY' },
    jiraService: { email: 'svc@example.com', token: 'test-token', baseUrl: 'https://example.atlassian.net' },
  },
}));
jest.mock('../digest/blogFetcher');
jest.mock('../jira/serviceClient');
jest.mock('@anthropic-ai/sdk');

const mockFetchLatestBlogPost = fetchLatestBlogPost as jest.MockedFunction<typeof fetchLatestBlogPost>;

const mockTicketExistsForLabel = jest.fn();
const mockCreateDigestTicket = jest.fn();
(JiraServiceClient as jest.MockedClass<typeof JiraServiceClient>).mockImplementation(() => ({
  ticketExistsForLabel: mockTicketExistsForLabel,
  createDigestTicket: mockCreateDigestTicket,
  createFinding: jest.fn(),
}) as unknown as JiraServiceClient);

const mockMessagesCreate = jest.fn();
(Anthropic as jest.MockedClass<typeof Anthropic>).mockImplementation(() => ({
  messages: { create: mockMessagesCreate },
}) as unknown as Anthropic);

const samplePost = {
  title: 'Extending Zero Trust to Non-Human Identities',
  url: 'https://www.oasis.security/blog/test-post',
  slug: 'test-post',
  content: 'This post discusses zero trust for NHI.',
};

beforeEach(() => {
  jest.clearAllMocks();
  config.digest.claudeApiKey = 'test-claude-key';
  config.digest.projectKey = 'IDENTITY';
  mockFetchLatestBlogPost.mockResolvedValue(samplePost);
  mockTicketExistsForLabel.mockResolvedValue(false);
  mockMessagesCreate.mockResolvedValue({
    content: [{ type: 'text', text: 'A concise AI-generated summary.' }],
  });
  mockCreateDigestTicket.mockResolvedValue('https://example.atlassian.net/browse/IDENTITY-99');
});

describe('runBlogDigestJob', () => {
  it('skips entirely when CLAUDE_API_KEY is not configured', async () => {
    config.digest.claudeApiKey = undefined;
    await runBlogDigestJob();
    expect(mockFetchLatestBlogPost).not.toHaveBeenCalled();
  });

  it('skips entirely when JIRA_BLOG_DIGEST_PROJECT_KEY is not configured', async () => {
    config.digest.projectKey = undefined;
    await runBlogDigestJob();
    expect(mockFetchLatestBlogPost).not.toHaveBeenCalled();
  });

  it('skips ticket creation when one already exists for the latest post', async () => {
    mockTicketExistsForLabel.mockResolvedValue(true);
    await runBlogDigestJob();
    expect(mockMessagesCreate).not.toHaveBeenCalled();
    expect(mockCreateDigestTicket).not.toHaveBeenCalled();
  });

  it('searches for the correct dedup label', async () => {
    mockTicketExistsForLabel.mockResolvedValue(true);
    await runBlogDigestJob();
    expect(mockTicketExistsForLabel).toHaveBeenCalledWith('blog-digest:test-post');
  });

  it('calls Claude only after confirming no existing ticket', async () => {
    await runBlogDigestJob();
    expect(mockTicketExistsForLabel).toHaveBeenCalled();
    expect(mockMessagesCreate).toHaveBeenCalled();
  });

  it('creates a ticket with the post title, AI summary, project key, and dedup label', async () => {
    await runBlogDigestJob();
    expect(mockCreateDigestTicket).toHaveBeenCalledWith(
      samplePost.title,
      'A concise AI-generated summary.',
      'IDENTITY',
      'blog-digest:test-post',
    );
  });

  it('uses claude-haiku model', async () => {
    await runBlogDigestJob();
    expect(mockMessagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-haiku-4-5-20251001' }),
    );
  });
});
