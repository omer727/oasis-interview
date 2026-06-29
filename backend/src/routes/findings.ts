import { Router, Request, Response } from 'express';
import { requireApiKey } from '../middleware/apiKey';
import { JiraServiceClient } from '../jira/serviceClient';
import { config } from '../config';
import { FindingTicketPayload, Severity, FindingType, IdentityType } from '@identityhub/shared';

const router = Router();

const VALID_SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low'];
const VALID_FINDING_TYPES: FindingType[] = ['stale-credential', 'overprivileged', 'expiring-credential', 'misconfigured'];
const VALID_IDENTITY_TYPES: IdentityType[] = ['service-account', 'api-key', 'service-principal', 'oauth-app'];

function validate(body: Partial<FindingTicketPayload>): string | null {
  if (!body.title?.trim()) return 'title is required';
  if (!body.projectKey?.trim()) return 'projectKey is required';
  if (!body.description?.trim()) return 'description is required';
  if (!body.severity || !VALID_SEVERITIES.includes(body.severity)) {
    return `severity must be one of: ${VALID_SEVERITIES.join(', ')}`;
  }
  if (!body.findingType || !VALID_FINDING_TYPES.includes(body.findingType)) {
    return `findingType must be one of: ${VALID_FINDING_TYPES.join(', ')}`;
  }
  if (!body.identityType || !VALID_IDENTITY_TYPES.includes(body.identityType)) {
    return `identityType must be one of: ${VALID_IDENTITY_TYPES.join(', ')}`;
  }
  return null;
}

router.post('/', requireApiKey, async (req: Request, res: Response) => {
  const validationError = validate(req.body);
  if (validationError) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: validationError } });
    return;
  }

  const payload = req.body as FindingTicketPayload;
  const client = new JiraServiceClient(
    config.jiraService.email,
    config.jiraService.token,
    config.jiraService.baseUrl,
  );

  try {
    const result = await client.createFinding(payload);
    res.status(201).json(result);
  } catch (err: unknown) {
    const axiosErr = err as { response?: { data?: { errors?: Record<string, unknown> }; status?: number } };
    const jiraMessage = axiosErr?.response?.data?.errors
      ? Object.values(axiosErr.response.data.errors).join(', ')
      : 'Failed to create ticket in Jira';
    const status = axiosErr?.response?.status === 404 ? 404 : 502;
    res.status(status).json({ error: { code: 'JIRA_ERROR', message: jiraMessage } });
  }
});

export default router;
