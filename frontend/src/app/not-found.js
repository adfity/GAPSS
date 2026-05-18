// C:\Users\hpvvi\Documents\magangBig\projectM2\frontend\src\app\not-found.js
"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="text-center space-y-6 max-w-md">
        {/* Animasi 404 */}
        <div className="relative">
          <h1 className="text-9xl font-bold bg-gradient-to-r from-gray-700 to-gray-900 dark:from-gray-300 dark:to-gray-100 bg-clip-text text-transparent">
            404
          </h1>
          <div className="absolute inset-0 flex items-center justify-center opacity-10">
            <svg className="w-32 h-32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        {/* Pesan error */}
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
          Halaman Tidak Ditemukan
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Maaf, halaman Pertumbuhan Ekonomi sedang dalam pengembangan atau tidak tersedia.
        </p>

        {/* Tombol kembali ke halaman sebelumnya */}
        <div className="flex gap-3 justify-center pt-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg
                       bg-gradient-to-r from-[#1378b7] to-[#1e90d8]
                       text-white font-medium
                       hover:shadow-lg hover:shadow-[#1378b7]/30
                       transition-all duration-200
                       focus:outline-none focus:ring-2 focus:ring-[#1378b7]/50"
          >
            <ArrowLeft size={18} />
            Kembali
          </button>
          
          {/* Tombol opsional: ke beranda (jika diperlukan) */}
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg
                       border border-gray-300 dark:border-gray-600
                       text-gray-700 dark:text-gray-300
                       hover:bg-gray-100 dark:hover:bg-gray-800
                       transition-all duration-200"
          >
            <Home size={18} />
            Beranda
          </button>
        </div>

        {/* Informasi tambahan */}
        <p className="text-xs text-gray-400 dark:text-gray-600 pt-4">
          Halaman ini akan segera tersedia
        </p>
      </div>
    </div>
  );
}