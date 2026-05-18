// src/middleware.js
import { NextResponse } from 'next/server';

export function middleware(request) {
  const token = request.cookies.get('access_token')?.value;
  const role = request.cookies.get('user_role')?.value;
  const { pathname } = request.nextUrl;

  // =========================
  // BELUM LOGIN
  // =========================
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // =========================
  // USER ONLY
  // =========================
  if (
    pathname.startsWith('/control_center') &&
    role !== 'user'
  ) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // =========================
  // ADMIN ONLY
  // =========================
  if (
    pathname.startsWith('/admin') &&
    role !== 'admin'
  ) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/control_center/:path*',
    '/admin/:path*',
  ],
};