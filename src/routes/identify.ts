import { Router } from 'express';
import { handleIdentify } from '../controllers';

const router = Router();

// POST /identify - Identify and link contacts
router.post('/identify', handleIdentify);

export default router;
