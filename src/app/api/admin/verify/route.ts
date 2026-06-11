import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  return NextResponse.json({ valid: isAdminRequest(req) });
}
