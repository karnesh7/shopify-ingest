// src/middleware/tenant.ts
import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

declare global {
  namespace Express {
    interface Request {
      tenant?: { id: number; name: string; slug: string; apiKey: string };
    }
  }
}

export async function requireTenant(req: Request, res: Response, next: NextFunction) {
  try {
    const apiKey = req.header('x-api-key') || req.header('authorization'); // support either
    if (!apiKey) {
      return res.status(401).json({ error: 'x-api-key header required' });
    }

    const tenant = await prisma.tenant.findUnique({ where: { apiKey } });

    if (!tenant) {
      return res.status(401).json({ error: 'invalid api key' });
    }

    req.tenant = { id: tenant.id, name: tenant.name, slug: tenant.slug, apiKey: tenant.apiKey };
    return next();
  } catch (err) {
    console.error('tenant middleware error', err);
    return res.status(500).json({ error: 'tenant auth error' });
  }
}
