import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers['x-api-key'];
  if (!key || key !== config.apiKey) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid API key' } });
    return;
  }
  next();
}
