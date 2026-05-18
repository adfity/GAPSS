'use client';
import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const accessToken = searchParams.get('access');
    const refreshToken = searchParams.get('refresh');
    const name = searchParams.get('name');
    const role = searchParams.get('role');
    const error = searchParams.get('error');

    if (error) {
      toast.error('Login Google gagal. Silakan coba lagi.');
      router.push('/login');
      return;
    }

    if (accessToken) {
      // localStorage
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);
      localStorage.setItem('user_name', name || '');
      localStorage.setItem('user_role', role || 'user');

      // ✅ Cookie untuk middleware
      document.cookie = `access_token=${accessToken}; path=/; max-age=3600; SameSite=Lax`;
      document.cookie = `user_role=${role || 'user'}; path=/; max-age=3600; SameSite=Lax`;

      toast.success(`Selamat datang, ${name || 'Pengguna'}!`);

      if (role === 'admin') {
        window.location.href = '/admin/dashboard';
      } else {
        window.location.href = '/';
      }
    } else {
      toast.error('Token tidak ditemukan.');
      router.push('/login');
    }
  }, [searchParams, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500 mx-auto" />
        <p className="text-slate-300">Menghubungkan akun Google...</p>
      </div>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500" />
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}