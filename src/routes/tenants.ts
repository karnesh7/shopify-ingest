// src/routes/tenants.ts
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();
const router = Router();

/**
 * POST /api/tenants
 * Body: { name: string, slug?: string }
 * Creates a tenant and returns its apiKey
 */
router.post('/', async (req, res) => {
  const { name, slug } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  try {
    const apiKey = crypto.randomBytes(24).toString('hex');
    const tenant = await prisma.tenant.create({
      data: {
        name,
        slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
        apiKey
      }
    });
    // return safe fields
    return res.status(201).json({ id: tenant.id, name: tenant.name, slug: tenant.slug, apiKey });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'could not create tenant', details: err });
  }
});

export default router;
