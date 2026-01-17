import request from 'supertest';
import { createServer } from '../src/server';

const env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET!,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET!,
  PORT: 4000,
  CORS_ORIGIN: 'http://localhost:5173',
  NODE_ENV: process.env.NODE_ENV as any || 'test',
};

const app = createServer(env);

describe('RBAC', () => {
  it('REPORTER no puede PATCH status => 403', async () => {
    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'reporter@example.com', password: 'password123' })
      .expect(200);
    const cookies = login.headers['set-cookie'];

    // get an issue from DEMO project
    const list = await request(app).get('/projects/').set('Cookie', cookies).expect(200);
    const projectId = list.body.find((p: any) => p.key === 'DEMO')?.id;
    expect(projectId).toBeTruthy();

    const issues = await request(app)
      .get(`/projects/${projectId}/issues`)
      .set('Cookie', cookies)
      .expect(200);
    const issueId = issues.body.items[0].id;

    await request(app)
      .patch(`/issues/${issueId}`)
      .set('Cookie', cookies)
      .send({ version: issues.body.items[0].version, status: 'IN_PROGRESS' })
      .expect(403);
  });
});
