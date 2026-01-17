import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import rateLimit from 'express-rate-limit';
import { Env } from './env';
import { authRouter } from './routes/auth';
import { projectsRouter } from './routes/projects';
import { issuesRouter } from './routes/issues';
import { commentsRouter } from './routes/comments';
import { meRouter } from './routes/me';
import { errorHandler } from './middleware/error';

export const createServer = (env: Env) => {
  const app = express();

  app.use(pinoHttp({
    customLogLevel: function (res, err) {
      const code = res.statusCode ?? 0;
      if (code >= 500 || err) return 'error';
      if (code >= 400) return 'warn';
      return 'info';
    },
    genReqId: function (req, res) {
      return req.headers['x-request-id']?.toString() || Math.random().toString(36).slice(2);
    },
  }));

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  const loginLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/auth/login', loginLimiter);

  app.use('/auth', authRouter(env));
  app.use('/projects', projectsRouter(env));
  app.use('/projects', issuesRouter(env));
  app.use('/issues', issuesRouter(env));
  app.use('/issues', commentsRouter(env));
  app.use('/me', meRouter(env));

  app.use(errorHandler());

  return app;
};
