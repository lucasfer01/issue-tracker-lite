import { prisma } from '../src/db';
import bcrypt from 'bcryptjs';

async function run() {
  const ownerEmail = 'owner@example.com';
  const reporterEmail = 'reporter@example.com';

  const owner = await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {},
    create: {
      email: ownerEmail,
      name: 'Owner User',
      passwordHash: await bcrypt.hash('password123', 10),
    },
  });

  const reporter = await prisma.user.upsert({
    where: { email: reporterEmail },
    update: {},
    create: {
      email: reporterEmail,
      name: 'Reporter User',
      passwordHash: await bcrypt.hash('password123', 10),
    },
  });

  const project = await prisma.project.upsert({
    where: { key: 'DEMO' },
    update: {},
    create: { key: 'DEMO', name: 'Demo Project', ownerId: owner.id },
  });

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: owner.id } },
    update: {},
    create: { projectId: project.id, userId: owner.id, role: 'OWNER' },
  });

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: reporter.id } },
    update: {},
    create: { projectId: project.id, userId: reporter.id, role: 'REPORTER' },
  });

  await prisma.projectCounter.upsert({
    where: { projectId: project.id },
    update: {},
    create: { projectId: project.id },
  });

  for (let i = 0; i < 5; i++) {
    const issue = await prisma.issue.upsert({
      where: { projectId_number: { projectId: project.id, number: i + 1 } },
      update: {},
      create: {
        projectId: project.id,
        number: i + 1,
        title: `Seed Issue ${i + 1}`,
        description: 'Demo seeded issue',
        status: 'OPEN',
        priority: 'MEDIUM',
        reporterId: owner.id,
      },
    });
    await prisma.issueEvent.upsert({
      where: { id: issue.id },
      update: {},
      create: { issueId: issue.id, actorId: owner.id, type: 'ISSUE_CREATED', payload: { title: issue.title, number: issue.number } },
    });
  }

  // Ajustar el contador al próximo número disponible
  await prisma.projectCounter.update({ where: { projectId: project.id }, data: { nextNumber: 6 } });

  console.log('Seed complete:', { ownerEmail, reporterEmail, projectKey: 'DEMO' });
}

run().finally(() => prisma.$disconnect());
