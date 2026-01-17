import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { httpError } from './error';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export const requireAuth = (accessSecret: string) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const token = req.cookies['access_token'] as string | undefined;
    if (!token) return next(httpError(401, 'UNAUTHENTICATED', 'No autenticado'));
    try {
      const payload = jwt.verify(token, accessSecret) as any;
      (req as any).user = { id: payload.sub, email: payload.email, name: payload.name } as AuthUser;
      next();
    } catch {
      return next(httpError(401, 'UNAUTHENTICATED', 'Token inválido o vencido'));
    }
  };
};

export const getMembership = async (projectId: string, userId: string) => {
  return prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } } });
};
