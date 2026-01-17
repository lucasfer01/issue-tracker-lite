import type { Request, Response, NextFunction } from 'express';

export const errorHandler = () => {
  return (err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || 500;
    const code = err.code || 'INTERNAL_ERROR';
    const message = err.message || 'Something went wrong';
    const details = err.details || undefined;
    res.status(status).json({ error: { code, message, details } });
  };
};

export const httpError = (status: number, code: string, message: string, details?: any) => {
  const e: any = new Error(message);
  e.status = status;
  e.code = code;
  e.details = details;
  return e;
};
