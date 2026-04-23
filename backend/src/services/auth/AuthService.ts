import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../../db/prismaClient';
import { Role } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret';
const REFRESH_EXPIRES_IN_DAYS = 7;

export interface TokenPayload {
  userId: string;
  email: string;
  role: Role;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  async register(
    email: string,
    password: string,
    role: 'student' | 'alumni',
    fullName: string,
    extraData?: { university?: string; graduationYear?: number; company?: string; jobTitle?: string }
  ) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new Error('Email already registered');

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: role as Role,
        fullName,
      },
    });

    // Create profile and digest preference
    if (role === 'student') {
      await prisma.studentProfile.create({
        data: {
          userId: user.id,
          university: extraData?.university,
          graduationYear: extraData?.graduationYear,
        },
      });
    } else if (role === 'alumni') {
      const alumniProfile = await prisma.alumniProfile.create({
        data: {
          userId: user.id,
          university: extraData?.university,
          company: extraData?.company,
          jobTitle: extraData?.jobTitle,
        },
      });
      // Create verification record
      await prisma.verificationRecord.create({
        data: { alumniProfileId: alumniProfile.id },
      });
    }

    await prisma.digestPreference.create({ data: { userId: user.id } });

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async login(email: string, password: string): Promise<{ user: object } & AuthTokens> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error('Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new Error('Invalid credentials');

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const record = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!record || record.revoked || record.expiresAt < new Date()) {
      throw new Error('Invalid or expired refresh token');
    }

    let payload: TokenPayload;
    try {
      payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as TokenPayload;
    } catch {
      throw new Error('Invalid refresh token');
    }

    // Rotate: revoke old token
    await prisma.refreshToken.update({ where: { id: record.id }, data: { revoked: true } });

    return this.generateTokens(payload.userId, payload.email, payload.role);
  }

  async logout(refreshToken: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { revoked: true },
    });
  }

  private async generateTokens(userId: string, email: string, role: Role): Promise<AuthTokens> {
    const payload: TokenPayload = { userId, email, role };

    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);

    const refreshPayload = { ...payload, jti: crypto.randomUUID() };
    const refreshToken = jwt.sign(refreshPayload, JWT_REFRESH_SECRET, { expiresIn: `${REFRESH_EXPIRES_IN_DAYS}d` } as jwt.SignOptions);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_EXPIRES_IN_DAYS);

    await prisma.refreshToken.create({
      data: { token: refreshToken, userId, expiresAt },
    });

    return { accessToken, refreshToken };
  }

  verifyAccessToken(token: string): TokenPayload {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  }

  private sanitizeUser(user: { id: string; email: string; role: Role; fullName: string; profilePhotoUrl: string | null; createdAt: Date }) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      profilePhotoUrl: user.profilePhotoUrl,
      createdAt: user.createdAt,
    };
  }
}

export const authService = new AuthService();
