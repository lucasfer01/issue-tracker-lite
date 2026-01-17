import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { Env } from '../env';
import { requireAuth } from '../middleware/auth';
import { httpError } from '../middleware/error';

const AddCommentSchema = z.object({ body: z.string().min(1) });

export const commentsRouter = (env: Env) => {
  const r = Router();

  r.get('/:issueId/comments', requireAuth(env.JWT_ACCESS_SECRET), async (req, res, next) => {
    const issueId = req.params.issueId;
    const issue = await prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue) return next(httpError(404, 'NOT_FOUND', 'Issue no encontrado'));

    const comments = await prisma.comment.findMany({ where: { issueId }, orderBy: { createdAt: 'asc' } });
    res.json(comments);
  });

  r.post('/:issueId/comments', requireAuth(env.JWT_ACCESS_SECRET), async (req, res, next) => {
    const parsed = AddCommentSchema.safeParse(req.body);
    if (!parsed.success) return next(httpError(400, 'VALIDATION_ERROR', 'Datos inválidos', parsed.error.flatten()));

    const issueId = req.params.issueId;
    const issue = await prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue) return next(httpError(404, 'NOT_FOUND', 'Issue no encontrado'));

    const user = (req as any).user as { id: string };
    const member = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId: issue.projectId, userId: user.id } } });
    if (!member) return next(httpError(403, 'FORBIDDEN', 'No sos miembro del proyecto'));

    const c = await prisma.comment.create({ data: { issueId, authorId: user.id, body: parsed.data.body } });
    await prisma.issueEvent.create({ data: { issueId, actorId: user.id, type: 'COMMENT_ADDED', payload: { commentId: c.id } } });
    res.status(201).json(c);
  });

  return r;
};
