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

describe('Validation', () => {
  it('create issue sin title => 400', async () => {
    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'owner@example.com', password: 'password123' })
      .expect(200);
    const cookies = login.headers['set-cookie'];

    const projects = await request(app).get('/projects').set('Cookie', cookies).expect(200);
    const projectId = projects.body[0].id;

    await request(app)
      .post(`/projects/${projectId}/issues`)
      .set('Cookie', cookies)
      .send({ description: 'no title' })
      .expect(400);
  });
});
