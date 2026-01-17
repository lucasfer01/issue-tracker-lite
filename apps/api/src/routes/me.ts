import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { Env } from '../env';

export const meRouter = (env: Env) => {
  const r = Router();
  r.get('/', requireAuth(env.JWT_ACCESS_SECRET), async (req, res) => {
    const user = (req as any).user;
    res.json({ id: user.id, email: user.email, name: user.name });
  });
  return r;
};
