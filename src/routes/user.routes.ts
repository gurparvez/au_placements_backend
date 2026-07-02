import { Router } from 'express';
import { searchUsersForMention } from '../controllers/userSearch.controller';
import { verifyJwt } from '../middlewares/auth.middleware';

const router = Router();

// @mention search — any authenticated user.
router.get('/search', verifyJwt, searchUsersForMention);

export default router;
