"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import HeaderBar from "@/components/layout/HeaderBar";
import SideBar from "@/components/layout/sideBar";
import { RotateCw } from "lucide-react";


const MapWithNoSSR = dynamic(() => import("@/components/MainMap"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-slate-900 text-white">
      Memuat Peta...
    </div>
  ),
});

export default function Home() {
  const [activePanel, setActivePanel] = useState(null);
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      const isMobile = window.innerWidth < 768;
      const isPort = window.innerHeight > window.innerWidth;
      setIsPortrait(isMobile && isPort);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      {/* PERINGATAN LANDSCAPE UNTUK MOBILE */}
      {isPortrait && (
        <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 backdrop-blur-lg flex flex-col items-center justify-center p-6 text-white">
          <div className="relative">
            <RotateCw size={80} className="text-cyan-400 animate-spin" style={{ animationDuration: '3s' }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 border-4 border-cyan-500/30 rounded-full"></div>
            </div>
          </div>
          
          <h2 className="text-3xl font-bold text-center mb-4 mt-8 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            Putar Layar Anda
          </h2>
          
          <div className="max-w-md text-center space-y-3">
            <p className="text-lg text-slate-200">
              Untuk pengalaman terbaik, gunakan mode <span className="font-bold text-cyan-400">landscape</span> (horizontal)
            </p>
            <p className="text-sm text-slate-400">
              Fitur peta memerlukan layar horizontal untuk navigasi optimal
            </p>
          </div>

          <div className="mt-8 flex gap-2">
            <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse"></div>
            <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <HeaderBar />

      {/* Sider */}
      <SideBar />

      {/* MAP */}
      <div className="flex-1 relative">
        <MapWithNoSSR
          activePanel={activePanel}
          setActivePanel={setActivePanel}
        />
      </div>
    </div>
  );
}