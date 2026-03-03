// src/middleware.js
import { NextResponse } from 'next/server';

export function middleware(request) {
  const token = request.cookies.get('access_token')?.value;
  const role = request.cookies.get('user_role')?.value;
  const { pathname } = request.nextUrl;

  // Belum login → redirect ke login
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Route /beranda dan /analisis → hanya role 'user'
  if (
    (pathname.startsWith('/beranda') || pathname.startsWith('/analisis')) &&
    role !== 'user'
  ) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/beranda/:path*',
    '/analisis/:path*',
  ],
};