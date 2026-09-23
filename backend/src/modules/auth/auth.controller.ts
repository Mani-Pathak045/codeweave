import { Request, Response } from 'express';
import { registerUser, loginUser } from './auth.service.js';

export async function register(req: Request, res: Response) {
  try {
    const { email, password, name } = req.body;
    const user = await registerUser(email, password, name);
    res.status(201).json({ id: user.id, email: user.email, name: user.name });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    const { user, accessToken, refreshToken } = await loginUser(email, password);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      accessToken,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
}