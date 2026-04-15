"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Home, Map, Users, Utensils, TreePine, BarChart3,
  ChevronRight, ChevronDown, ChevronsLeft,
} from "lucide-react";

const menuItems = [
  { label: "Home", icon: Home, href: "/map" },
  // { label: "Map",     icon: Map,  href: "/map"     },
  { label: "SDM Nasional ",    icon: Users,  href: "/analisis/sdm"              },
  { label: "Ketahanan Pangan",    icon: Utensils,  href: "/analisis/pangan"              },
  { label: "Sumber Kekayaan Alam",icon: TreePine,  href: "/analisis/sda"                 },
  { label: "Pertumbuhan Ekonomi", icon: BarChart3, href: "/not-found" },
];

const notifyHeaderbar = (isOpen) => {
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent("sidebar-state", { detail: { isOpen } }));
  }, 0);
};

export default function SideBar() {
  const pathname      = usePathname();
  const isLandingPage = pathname === "/";

  const [isOpen,      setIsOpen]      = useState(false);
  const sidebarRef = useRef(null);

  if (isLandingPage) return null;

  useEffect(() => {
    const onToggle = () => {
      setIsOpen((prev) => {
        const next = !prev;
        notifyHeaderbar(next);
        return next;
      });
    };
    window.addEventListener("toggle-sidebar", onToggle);
    return () => window.removeEventListener("toggle-sidebar", onToggle);
  }, []);

  useEffect(() => {
    const handleOutside = (e) => {
      if (isOpen && sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        setIsOpen(false);
        notifyHeaderbar(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isOpen]);

  const close = () => {
    setIsOpen(false);
    notifyHeaderbar(false);
  };

  const isActiveHref = (href) =>
    pathname === href || pathname?.startsWith(href + "/");

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={close}
        className={`fixed inset-0 z-[1250] bg-black/20 backdrop-blur-[2px]
                    transition-all duration-300
                    ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
      />

      {/* Panel */}
      <aside
        ref={sidebarRef}
        className={`fixed top-0 left-0 h-full z-[1300]
                    w-[285px] flex flex-col
                    bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl
                    border-r border-white/20 dark:border-slate-700/30
                    shadow-2xl shadow-black/10
                    transition-transform duration-300 ease-in-out
                    ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Header: Logo + Close */}
        <div className="flex items-center justify-between px-5 h-[60px] shrink-0
                        border-b border-white/20 dark:border-slate-700/30">
          <Link href="/" onClick={close} className="flex items-center hover:opacity-85 transition-opacity">
            <Image src="/icons/GAPSS.png" alt="Synap" width={100} height={40} />
          </Link>

          {/* Close button */}
          <button
            onClick={close}
            aria-label="Tutup Sidebar"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg
                      bg-[#1378b7]/10 hover:bg-[#1378b7]/20
                      dark:bg-[#1378b7]/20 dark:hover:bg-[#1378b7]/30
                      text-[#1378b7] dark:text-cyan-400
                      transition-all duration-200 group select-none"
          >
            <ChevronsLeft
              size={18}
              strokeWidth={4}
              className="group-hover:-translate-x-0.5 transition-transform"
            />
            
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 custom-scrollbar space-y-1">
          {menuItems.map((item, idx) => {
            const Icon = item.icon;

            return (
              <Link
                key={idx}
                href={item.href}
                onClick={close}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl
                            text-[15px] font-semibold transition-all duration-200
                            ${isActiveHref(item.href)
                              ? "bg-gradient-to-r from-[#1378b7] to-[#1e90d8] text-white shadow-md shadow-[#1378b7]/30"
                              : "text-slate-700 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50 hover:text-black dark:hover:text-white"
                            }`}
                >
                <Icon size={19} className="shrink-0" />
                <span className="flex-1">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* ========== PERBAIKAN FOOTER ========== */}
        <div className="px-5 py-4 border-t border-white/30 dark:border-slate-700/40 mt-auto">
          <div className="flex items-center justify-center gap-2">
            {/* Indikator hijau dengan efek glow halus di dark mode */}
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 shadow-[0_0_4px_#10b981] dark:shadow-[0_0_6px_#34d399]" />
            
            {/* Teks dengan kontras tinggi di light & dark mode */}
            <p className="text-[11px] font-medium tracking-wide uppercase
                          text-gray-600 dark:text-gray-400
                          hover:text-gray-800 dark:hover:text-gray-300
                          transition-colors duration-200">
              Badan Informasi Geospasial
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}