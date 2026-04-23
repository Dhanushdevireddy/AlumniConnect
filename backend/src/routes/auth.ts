import { Router, Request, Response } from 'express';
import { authService } from '../services/auth/AuthService';
import { authenticate } from '../middleware/auth';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, role, fullName, university, graduationYear, company, jobTitle } = req.body;
    if (!email || !password || !role || !fullName) {
      res.status(400).json({ error: 'email, password, role, and fullName are required' });
      return;
    }
    if (!['student', 'alumni'].includes(role)) {
      res.status(400).json({ error: 'role must be student or alumni' });
      return;
    }
    const result = await authService.register(email, password, role, fullName, { university, graduationYear, company, jobTitle });
    res.status(201).json(result);
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) { res.status(400).json({ error: 'email and password required' }); return; }
    const result = await authService.login(email, password);
    res.json(result);
  } catch (err: unknown) {
    res.status(401).json({ error: err instanceof Error ? err.message : 'Login failed' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) { res.status(400).json({ error: 'refreshToken required' }); return; }
    const tokens = await authService.refresh(refreshToken);
    res.json(tokens);
  } catch (err: unknown) {
    res.status(401).json({ error: err instanceof Error ? err.message : 'Refresh failed' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) await authService.logout(refreshToken);
    res.json({ message: 'Logged out' });
  } catch {
    res.json({ message: 'Logged out' });
  }
});

export default router;
