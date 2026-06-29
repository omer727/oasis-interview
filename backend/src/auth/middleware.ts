import { Request, Response, NextFunction } from 'express';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.user) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    return;
  }
  next();
}

export function requireJiraConnected(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.jira) {
    res.status(403).json({ error: { code: 'JIRA_NOT_CONNECTED', message: 'Jira workspace not connected. Visit /api/jira/connect to link your account.' } });
    return;
  }
  next();
}
