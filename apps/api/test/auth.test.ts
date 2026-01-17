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

describe('Auth flow', () => {
  it('login ok + /me ok', async () => {
    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'owner@example.com', password: 'password123' })
      .expect(200);
    const cookies = login.headers['set-cookie'];
    expect(cookies).toBeTruthy();

    const me = await request(app).get('/me').set('Cookie', cookies).expect(200);
    expect(me.body.email).toBe('owner@example.com');
  });
});
