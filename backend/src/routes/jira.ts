import { Router, Request, Response } from 'express';
import { requireAuth, requireJiraConnected } from '../auth/middleware';
import { JiraUserClient } from '../jira/userClient';
import { FindingTicketPayload } from '@identityhub/shared';

const router = Router();

function getJiraClient(req: Request): JiraUserClient {
  const { accessToken, cloudId, baseUrl } = req.session.jira!;
  return new JiraUserClient(accessToken, cloudId, baseUrl);
}

router.get('/projects', requireAuth, requireJiraConnected, async (req: Request, res: Response) => {
  try {
    const projects = await getJiraClient(req).getProjects();
    res.json(projects);
  } catch (err) {
    console.error('Failed to fetch Jira projects:', err);
    res.status(502).json({ error: { code: 'JIRA_ERROR', message: 'Failed to fetch projects from Jira' } });
  }
});

router.post('/findings', requireAuth, requireJiraConnected, async (req: Request, res: Response) => {
  const { projectKey, title, description, severity, findingType, identityType } = req.body as FindingTicketPayload;

  if (!projectKey || !title || !description || !severity || !findingType || !identityType) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'All fields are required: projectKey, title, description, severity, findingType, identityType' } });
    return;
  }

  try {
    const result = await getJiraClient(req).createFinding({ projectKey, title, description, severity, findingType, identityType });
    res.status(201).json(result);
  } catch (err: unknown) {
    const axiosErr = err as { response?: { data?: { errors?: Record<string, unknown> } } };
    const jiraMessage = axiosErr?.response?.data?.errors
      ? Object.values(axiosErr.response.data.errors).join(', ')
      : 'Failed to create ticket in Jira';
    res.status(502).json({ error: { code: 'JIRA_ERROR', message: jiraMessage } });
  }
});

router.get('/projects/:projectKey/recent-findings', requireAuth, requireJiraConnected, async (req: Request, res: Response) => {
  const { projectKey } = req.params;
  try {
    const tickets = await getJiraClient(req).getRecentFindings(projectKey);
    res.json(tickets);
  } catch (err) {
    console.error('Failed to fetch recent findings:', err);
    res.status(502).json({ error: { code: 'JIRA_ERROR', message: 'Failed to fetch recent tickets from Jira' } });
  }
});

export default router;
