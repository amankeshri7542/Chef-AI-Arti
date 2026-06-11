// Admin panel auth — completely separate from Clerk.
// Simple httpOnly-cookie token derived from ADMIN_PASSWORD env var.
// Server-only: uses node:crypto + next/headers.

import { createHash, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';

export const ADMIN_COOKIE = 'admin_token';

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Token = sha256(password + ADMIN_PASSWORD).
 * For the correct password this equals sha256(ADMIN_PASSWORD + ADMIN_PASSWORD).
 */
export function createAdminToken(password: string): string {
  const secret = process.env.ADMIN_PASSWORD ?? '';
  return sha256Hex(password + secret);
}

/** Constant-time check of a token against the expected admin token. */
export function verifyAdminToken(token: string | undefined | null): boolean {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret || !token) return false;
  const expected = sha256Hex(secret + secret);
  const a = Buffer.from(token, 'utf-8');
  const b = Buffer.from(expected, 'utf-8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Server-component guard. Call at the top of every protected /admin page.
 * Redirects to /admin/login when the cookie is missing or invalid.
 */
export async function requireAdmin(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!verifyAdminToken(token)) {
    redirect('/admin/login');
  }
}

/** API-route guard. Returns true when the request carries a valid admin cookie. */
export function isAdminRequest(req: NextRequest): boolean {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  return verifyAdminToken(token);
}
