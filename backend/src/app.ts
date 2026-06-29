import express from 'express';
import session from 'express-session';
import cors from 'cors';
import passport from 'passport';
import { config } from './config';
import './auth/google';
import './types/session';
import authRouter from './routes/auth';
import jiraAuthRouter from './routes/jiraAuth';
import jiraRouter from './routes/jira';
import findingsRouter from './routes/findings';

export function createApp(): express.Application {
  const app = express();

  app.use(cors({ origin: config.frontendUrl, credentials: true }));
  app.use(express.json());
  app.use(session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.nodeEnv === 'production',
      maxAge: 24 * 60 * 60 * 1000,
    },
  }));
  app.use(passport.initialize());
  app.use(passport.session());

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRouter);
  app.use('/api/jira', jiraAuthRouter);
  app.use('/api/jira', jiraRouter);
  app.use('/api/v1/findings', findingsRouter);

  return app;
}
