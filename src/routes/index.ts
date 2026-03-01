import { Router } from 'express';
import identifyRoutes from './identify';
import { prisma } from '../config/database';

const router = Router();

// Root redirect → Swagger UI
router.get('/', (req, res) => {
  res.redirect('/api-docs');
});

// Mount routes
router.use('/', identifyRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test reset endpoint (non-production only)
router.post('/test-reset', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({ error: 'Not allowed in production' });
    return;
  }
  await prisma.$executeRawUnsafe('TRUNCATE "Contact" RESTART IDENTITY CASCADE;');
  res.status(200).json({ ok: true, message: 'Database reset' });
});

export default router;
