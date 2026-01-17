import { Router } from 'express';
import { z } from 'zod';
import { Env } from '../env';
import { prisma } from '../db';
import { requireAuth } from '../middleware/auth';
import { httpError } from '../middleware/error';

const CreateProjectSchema = z.object({ key: z.string().min(2), name: z.string().min(2) });
const AddMemberSchema = z.object({ email: z.string().email(), role: z.enum(['OWNER', 'MAINTAINER', 'REPORTER']) });

export const projectsRouter = (env: Env) => {
  const r = Router();

  r.get('/', requireAuth(env.JWT_ACCESS_SECRET), async (req, res) => {
    const user = (req as any).user as { id: string };
    const memberships = await prisma.projectMember.findMany({
      where: { userId: user.id },
      include: { project: true },
    });
    res.json(memberships.map((m) => ({ id: m.project.id, key: m.project.key, name: m.project.name })));
  });

  r.post('/', requireAuth(env.JWT_ACCESS_SECRET), async (req, res, next) => {
    const parsed = CreateProjectSchema.safeParse(req.body);
    if (!parsed.success) return next(httpError(400, 'VALIDATION_ERROR', 'Datos inválidos', parsed.error.flatten()));

    const user = (req as any).user as { id: string };
    try {
      const project = await prisma.$transaction(async (tx) => {
        const p = await tx.project.create({ data: { key: parsed.data.key, name: parsed.data.name, ownerId: user.id } });
        await tx.projectMember.create({ data: { projectId: p.id, userId: user.id, role: 'OWNER' } });
        await tx.projectCounter.create({ data: { projectId: p.id } });
        return p;
      });
      res.status(201).json(project);
    } catch (e: any) {
      if (e.code === 'P2002') return next(httpError(409, 'CONFLICT', 'Key de proyecto ya existe'));
      throw e;
    }
  });

  r.get('/:projectId', requireAuth(env.JWT_ACCESS_SECRET), async (req, res, next) => {
    const user = (req as any).user as { id: string };
    const projectId = req.params.projectId;
    const member = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: user.id } } });
    if (!member) return next(httpError(403, 'FORBIDDEN', 'No sos miembro del proyecto'));
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return next(httpError(404, 'NOT_FOUND', 'Proyecto no encontrado'));
    res.json(project);
  });

  r.post('/:projectId/members', requireAuth(env.JWT_ACCESS_SECRET), async (req, res, next) => {
    const parsed = AddMemberSchema.safeParse(req.body);
    if (!parsed.success) return next(httpError(400, 'VALIDATION_ERROR', 'Datos inválidos', parsed.error.flatten()));

    const user = (req as any).user as { id: string };
    const projectId = req.params.projectId;
    const caller = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: user.id } } });
    if (!caller || caller.role !== 'OWNER') return next(httpError(403, 'FORBIDDEN', 'Solo OWNER puede agregar miembros'));

    const target = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!target) return next(httpError(404, 'NOT_FOUND', 'Usuario no encontrado'));

    try {
      await prisma.projectMember.create({ data: { projectId, userId: target.id, role: parsed.data.role } });
      res.status(201).json({ ok: true });
    } catch (e: any) {
      if (e.code === 'P2002') return next(httpError(409, 'CONFLICT', 'Usuario ya es miembro'));
      throw e;
    }
  });

  return r;
};
