import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { httpError } from '../middleware/error';
import { Env } from '../env';

const LoginSchema = z.object({ email: z.string().email(), password: z.string().min(6) });

function signAccess(user: { id: string; email: string; name: string }, secret: string) {
  return jwt.sign({ email: user.email, name: user.name }, secret, {
    subject: user.id,
    expiresIn: '15m',
  });
}

function signRefresh(user: { id: string }, secret: string) {
  return jwt.sign({}, secret, {
    subject: user.id,
    expiresIn: '7d',
  });
}

function cookieOptions(env: Env) {
  const isProd = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/',
  };
}

export const authRouter = (env: Env) => {
  const r = Router();

  r.post('/login', async (req, res, next) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) return next(httpError(400, 'VALIDATION_ERROR', 'Datos inválidos', parsed.error.flatten()));

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user) return next(httpError(401, 'INVALID_CREDENTIALS', 'Credenciales inválidas'));

    const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!ok) return next(httpError(401, 'INVALID_CREDENTIALS', 'Credenciales inválidas'));

    const access = signAccess({ id: user.id, email: user.email, name: user.name }, env.JWT_ACCESS_SECRET);
    const refresh = signRefresh({ id: user.id }, env.JWT_REFRESH_SECRET);

    const hash = await bcrypt.hash(refresh, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({ data: { userId: user.id, tokenHash: hash, expiresAt } });

    res.cookie('access_token', access, { ...cookieOptions(env), maxAge: 15 * 60 * 1000 });
    res.cookie('refresh_token', refresh, { ...cookieOptions(env), maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ ok: true });
  });

  r.post('/refresh', async (req, res, next) => {
    const refresh = req.cookies['refresh_token'];
    if (!refresh) return next(httpError(401, 'UNAUTHENTICATED', 'No autenticado'));
    try {
      const payload = jwt.verify(refresh, env.JWT_REFRESH_SECRET) as any;
      const userId = payload.sub as string;

      const tokens = await prisma.refreshToken.findMany({ where: { userId, revokedAt: null } });
      const match = await (async () => {
        for (const t of tokens) {
          if (await bcrypt.compare(refresh, t.tokenHash)) return t;
        }
        return null;
      })();
      if (!match) return next(httpError(401, 'UNAUTHENTICATED', 'Refresh inválido'));

      await prisma.refreshToken.update({ where: { id: match.id }, data: { revokedAt: new Date() } });

      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      const newAccess = signAccess({ id: user.id, email: user.email, name: user.name }, env.JWT_ACCESS_SECRET);
      const newRefresh = signRefresh({ id: user.id }, env.JWT_REFRESH_SECRET);
      const hash = await bcrypt.hash(newRefresh, 10);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await prisma.refreshToken.create({ data: { userId: user.id, tokenHash: hash, expiresAt } });

      res.cookie('access_token', newAccess, { ...cookieOptions(env), maxAge: 15 * 60 * 1000 });
      res.cookie('refresh_token', newRefresh, { ...cookieOptions(env), maxAge: 7 * 24 * 60 * 60 * 1000 });
      res.json({ ok: true });
    } catch (e) {
      return next(httpError(401, 'UNAUTHENTICATED', 'Refresh inválido o vencido'));
    }
  });

  r.post('/logout', async (req, res) => {
    const refresh = req.cookies['refresh_token'];
    if (refresh) {
      try {
        const payload = jwt.verify(refresh, env.JWT_REFRESH_SECRET) as any;
        const userId = payload.sub as string;
        const tokens = await prisma.refreshToken.findMany({ where: { userId, revokedAt: null } });
        for (const t of tokens) {
          if (await bcrypt.compare(refresh, t.tokenHash)) {
            await prisma.refreshToken.update({ where: { id: t.id }, data: { revokedAt: new Date() } });
            break;
          }
        }
      } catch {}
    }
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    res.json({ ok: true });
  });

  return r;
};
