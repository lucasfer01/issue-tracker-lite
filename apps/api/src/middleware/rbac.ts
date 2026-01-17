import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';
import { httpError } from './error';

const roleRank = { REPORTER: 1, MAINTAINER: 2, OWNER: 3 } as const;

export const requireProjectRole = (minRole: keyof typeof roleRank) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as any).user as { id: string } | undefined;
    if (!user) return next(httpError(401, 'UNAUTHENTICATED', 'No autenticado'));

    const projectId = (req.params.projectId || req.body.projectId || req.query.projectId) as string;
    if (!projectId) return next(httpError(400, 'VALIDATION_ERROR', 'projectId requerido'));

    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    });
    if (!membership) return next(httpError(403, 'FORBIDDEN', 'No sos miembro del proyecto'));

    if (roleRank[membership.role] < roleRank[minRole]) {
      return next(httpError(403, 'FORBIDDEN', 'Rol insuficiente'));
    }
    next();
  };
};
