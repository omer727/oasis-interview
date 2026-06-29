import { Router } from 'express';
import passport from 'passport';
import { config } from '../config';
import { requireAuth } from '../auth/middleware';

const router = Router();

router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: `${config.frontendUrl}/login?error=auth_failed` }),
  (req, res) => {
    req.session.user = req.user as typeof req.session.user;
    res.redirect(config.frontendUrl + '/dashboard');
  }
);

router.get('/me', requireAuth, (req, res) => {
  res.json(req.session.user);
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

export default router;
