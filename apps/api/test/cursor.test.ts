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

describe('Cursor pagination', () => {
  it('devuelve nextCursor y no duplica items', async () => {
    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'owner@example.com', password: 'password123' })
      .expect(200);
    const cookies = login.headers['set-cookie'];

    const projects = await request(app).get('/projects').set('Cookie', cookies).expect(200);
    const projectId = projects.body[0].id;

    const first = await request(app)
      .get(`/projects/${projectId}/issues?limit=2`)
      .set('Cookie', cookies)
      .expect(200);
    const nextCursor = first.body.nextCursor;
    expect(nextCursor).toBeTruthy();

    const second = await request(app)
      .get(`/projects/${projectId}/issues?limit=2&cursor=${encodeURIComponent(nextCursor)}`)
      .set('Cookie', cookies)
      .expect(200);

    const ids1 = first.body.items.map((i: any) => i.id);
    const ids2 = second.body.items.map((i: any) => i.id);
    const intersection = ids1.filter((id: string) => ids2.includes(id));
    expect(intersection.length).toBe(0);
  });
});
