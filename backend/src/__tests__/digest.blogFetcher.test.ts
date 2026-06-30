import { toJiraLabelSlug } from '../digest/blogFetcher';

describe('toJiraLabelSlug', () => {
  it('lowercases the input', () => {
    expect(toJiraLabelSlug('Hello-World')).toBe('hello-world');
  });

  it('replaces spaces with hyphens', () => {
    expect(toJiraLabelSlug('some post title')).toBe('some-post-title');
  });

  it('strips special characters', () => {
    expect(toJiraLabelSlug('oasis/zscaler_partnership!')).toBe('oasis-zscaler-partnership');
  });

  it('collapses multiple consecutive hyphens', () => {
    expect(toJiraLabelSlug('hello---world')).toBe('hello-world');
  });

  it('removes leading and trailing hyphens', () => {
    expect(toJiraLabelSlug('--hello-world--')).toBe('hello-world');
  });

  it('handles a clean slug unchanged', () => {
    expect(toJiraLabelSlug('oasis-zscaler-partnership')).toBe('oasis-zscaler-partnership');
  });

  it('handles colons by replacing them with hyphens', () => {
    expect(toJiraLabelSlug('post:title')).toBe('post-title');
  });
});
