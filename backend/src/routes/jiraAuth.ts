import { Router, Request, Response } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { config } from '../config';
import { requireAuth } from '../auth/middleware';

const router = Router();

router.get('/connect', requireAuth, (req: Request, res: Response) => {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.jiraOAuthState = state;

  const params = new URLSearchParams({
    audience: 'api.atlassian.com',
    client_id: config.jira.clientId,
    scope: 'read:jira-work write:jira-work offline_access',
    redirect_uri: config.jira.callbackUrl,
    state,
    response_type: 'code',
    prompt: 'consent',
  });

  res.redirect(`https://auth.atlassian.com/authorize?${params}`);
});

router.get('/callback', requireAuth, async (req: Request, res: Response) => {
  const { code, state } = req.query;

  if (state !== req.session.jiraOAuthState) {
    res.status(400).json({ error: { code: 'INVALID_STATE', message: 'OAuth state mismatch' } });
    return;
  }
  delete req.session.jiraOAuthState;

  try {
    const tokenRes = await axios.post('https://auth.atlassian.com/oauth/token', {
      grant_type: 'authorization_code',
      client_id: config.jira.clientId,
      client_secret: config.jira.clientSecret,
      code,
      redirect_uri: config.jira.callbackUrl,
    });

    const { access_token: accessToken, refresh_token: refreshToken } = tokenRes.data;

    const resourcesRes = await axios.get('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const site = resourcesRes.data[0];
    if (!site) {
      res.status(400).json({ error: { code: 'NO_JIRA_SITE', message: 'No Jira sites found for this account' } });
      return;
    }

    req.session.jira = {
      accessToken,
      refreshToken,
      cloudId: site.id,
      baseUrl: site.url,
    };

    res.redirect(`${config.frontendUrl}/dashboard`);
  } catch (err) {
    console.error('Jira OAuth callback error:', err);
    res.redirect(`${config.frontendUrl}/dashboard?error=jira_auth_failed`);
  }
});

router.post('/disconnect', requireAuth, (req: Request, res: Response) => {
  delete req.session.jira;
  res.json({ ok: true });
});

router.get('/status', requireAuth, (req: Request, res: Response) => {
  if (!req.session.jira) {
    res.json({ connected: false });
    return;
  }
  res.json({ connected: true, baseUrl: req.session.jira.baseUrl });
});

export default router;
