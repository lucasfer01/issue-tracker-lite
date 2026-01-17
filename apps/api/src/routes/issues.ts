import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { Env } from '../env';
import { requireAuth } from '../middleware/auth';
import { httpError } from '../middleware/error';
import { decodeCursor, encodeCursor } from '../utils/cursor';

const CreateIssueSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
});

const ListQuerySchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE']).optional(),
  assigneeId: z.string().uuid().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

const PatchIssueSchema = z.object({
  version: z.number().int(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE']).optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
});

export const issuesRouter = (env: Env) => {
  const r = Router();

  r.get('/:projectId/issues', requireAuth(env.JWT_ACCESS_SECRET), async (req, res, next) => {
    const user = (req as any).user as { id: string };
    const projectId = req.params.projectId;
    const member = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: user.id } } });
    if (!member) return next(httpError(403, 'FORBIDDEN', 'No sos miembro del proyecto'));

    const params = ListQuerySchema.safeParse(req.query);
    if (!params.success) return next(httpError(400, 'VALIDATION_ERROR', 'Query inválida', params.error.flatten()));
    const { limit, status, assigneeId, q, cursor } = params.data;

    let cursorFilter: any = undefined;
    if (cursor) {
      const c = decodeCursor(cursor);
      if (!c) return next(httpError(400, 'VALIDATION_ERROR', 'Cursor inválido'));
      cursorFilter = {
        OR: [
          { createdAt: { lt: new Date(c.createdAt) } },
          { AND: [{ createdAt: new Date(c.createdAt) }, { id: { lt: c.id } }] },
        ],
      };
    }

    const where: any = { projectId };
    if (status) where.status = status;
    if (assigneeId) where.assigneeId = assigneeId;
    if (q) where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ];

    const items = await prisma.issue.findMany({
      where: cursorFilter ? { AND: [where, cursorFilter] } : where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });

    let nextCursor: string | null = null;
    if (items.length === limit) {
      const last = items[items.length - 1];
      nextCursor = encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id });
    }

    res.json({ items, nextCursor });
  });

  r.post('/:projectId/issues', requireAuth(env.JWT_ACCESS_SECRET), async (req, res, next) => {
    const parsed = CreateIssueSchema.safeParse(req.body);
    if (!parsed.success) return next(httpError(400, 'VALIDATION_ERROR', 'Datos inválidos', parsed.error.flatten()));

    const user = (req as any).user as { id: string };
    const projectId = req.params.projectId;

    const member = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: user.id } } });
    if (!member || (member.role !== 'OWNER' && member.role !== 'MAINTAINER')) {
      return next(httpError(403, 'FORBIDDEN', 'Rol insuficiente para crear issue'));
    }

    const result = await prisma.$transaction(async (tx) => {
      const row = await tx.$queryRaw<{ issue_number: number }[]>`
        UPDATE project_counters SET next_number = next_number + 1 WHERE project_id = ${projectId}
        RETURNING next_number - 1 AS issue_number
      `;
      const number = row[0]?.issue_number;
      if (!number && number !== 0) throw new Error('No se pudo generar número');

      const issue = await tx.issue.create({
        data: {
          projectId,
          number,
          title: parsed.data.title,
          description: parsed.data.description,
          status: 'OPEN',
          priority: parsed.data.priority,
          reporterId: user.id,
        },
      });
      await tx.issueEvent.create({
        data: {
          issueId: issue.id,
          actorId: user.id,
          type: 'ISSUE_CREATED',
          payload: { title: issue.title, number: issue.number },
        },
      });
      return issue;
    });

    res.status(201).json(result);
  });

  r.get('/:issueId', requireAuth(env.JWT_ACCESS_SECRET), async (req, res, next) => {
    const issueId = req.params.issueId;
    const issue = await prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue) return next(httpError(404, 'NOT_FOUND', 'Issue no encontrado'));
    const user = (req as any).user as { id: string };
    const member = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId: issue.projectId, userId: user.id } } });
    if (!member) return next(httpError(403, 'FORBIDDEN', 'No sos miembro del proyecto'));
    res.json(issue);
  });

  r.patch('/:issueId', requireAuth(env.JWT_ACCESS_SECRET), async (req, res, next) => {
    const parsed = PatchIssueSchema.safeParse(req.body);
    if (!parsed.success) return next(httpError(400, 'VALIDATION_ERROR', 'Datos inválidos', parsed.error.flatten()));
    const issueId = req.params.issueId;
    const user = (req as any).user as { id: string };

    const issue = await prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue) return next(httpError(404, 'NOT_FOUND', 'Issue no encontrado'));

    const member = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId: issue.projectId, userId: user.id } } });
    if (!member) return next(httpError(403, 'FORBIDDEN', 'No sos miembro del proyecto'));

    const requiresElevated = parsed.data.status || parsed.data.assigneeId !== undefined;
    if (requiresElevated && !(member.role === 'OWNER' || member.role === 'MAINTAINER')) {
      return next(httpError(403, 'FORBIDDEN', 'Rol insuficiente'));
    }

    const data: any = {};
    const events: { type: 'STATUS_CHANGED' | 'ASSIGNEE_CHANGED' | 'ISSUE_UPDATED'; payload: any }[] = [];

    if (parsed.data.title && parsed.data.title !== issue.title) data.title = parsed.data.title;
    if (parsed.data.description && parsed.data.description !== issue.description) data.description = parsed.data.description;
    if (parsed.data.priority && parsed.data.priority !== issue.priority) data.priority = parsed.data.priority;
    if (parsed.data.status && parsed.data.status !== issue.status) {
      data.status = parsed.data.status;
      events.push({ type: 'STATUS_CHANGED', payload: { from: issue.status, to: parsed.data.status } });
    }
    if (parsed.data.assigneeId !== undefined && parsed.data.assigneeId !== issue.assigneeId) {
      data.assigneeId = parsed.data.assigneeId;
      events.push({ type: 'ASSIGNEE_CHANGED', payload: { from: issue.assigneeId, to: parsed.data.assigneeId } });
    }

    // Optimistic locking via updateMany with version match
    const updated = await prisma.issue.updateMany({
      where: { id: issueId, version: parsed.data.version },
      data: { ...data, version: { increment: 1 } },
    });
    if (updated.count === 0) return next(httpError(409, 'CONFLICT', 'Versión desactualizada'));

    // Create events
    if (events.length === 0) {
      await prisma.issueEvent.create({ data: { issueId, actorId: user.id, type: 'ISSUE_UPDATED', payload: data } });
    } else {
      for (const e of events) {
        await prisma.issueEvent.create({ data: { issueId, actorId: user.id, type: e.type, payload: e.payload } });
      }
    }

    const fresh = await prisma.issue.findUniqueOrThrow({ where: { id: issueId } });
    res.json(fresh);
  });

  return r;
};
