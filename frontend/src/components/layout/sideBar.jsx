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
  { label: "Beranda", icon: Home, href: "/beranda" },
  { label: "Map",     icon: Map,  href: "/map"     },
  {
    label: "SDM Nasional", icon: Users,
    children: [
      { label: "Ekonomi",    href: "/analisis/ekonomi"    },
      { label: "Pendidikan", href: "/analisis/pendidikan" },
      { label: "Kesehatan",  href: "/analisis/kesehatan"  },
    ],
  },
  { label: "Ketahanan Pangan",    icon: Utensils,  href: "/analisis/pangan"              },
  { label: "Sumber Kekayaan Alam",icon: TreePine,  href: "/analisis/sda"                 },
  { label: "Pertumbuhan Ekonomi", icon: BarChart3, href: "/analisis/pertumbuhan-ekonomi" },
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
  const [openGroups,  setOpenGroups]  = useState({});
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

  useEffect(() => {
    menuItems.forEach((item, idx) => {
      if (item.children) {
        const isActive = item.children.some((c) => pathname?.startsWith(c.href));
        if (isActive) setOpenGroups((prev) => ({ ...prev, [idx]: true }));
      }
    });
  }, [pathname]);

  const close = () => {
    setIsOpen(false);
    notifyHeaderbar(false);
  };

  const toggleGroup = (idx) =>
    setOpenGroups((prev) => ({ ...prev, [idx]: !prev[idx] }));

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
                    w-[280px] flex flex-col
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
            <Image src="/icons/tiragapss.png" alt="TerraSeg" width={100} height={40} className="block dark:hidden" />
            <Image src="/icons/tiragapss.png" alt="TerraSeg" width={100} height={40} className="hidden dark:block" />
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
            const Icon       = item.icon;
            const hasChildren = !!item.children;
            const groupOpen  = openGroups[idx];

            return (
              <div key={idx}>
                {hasChildren ? (
                  <div>
                    <button
                      onClick={() => toggleGroup(idx)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left
                                  transition-all duration-200
                                  ${item.children.some((c) => pathname?.startsWith(c.href))
                                    ? "bg-[#1378b7]/15 dark:bg-[#1378b7]/25 text-[#1378b7] dark:text-cyan-400"
                                    : "text-slate-900 dark:text-slate-300 hover:bg-white/40 dark:hover:bg-slate-700/40 hover:text-black dark:hover:text-white"
                                  }`}
                    >
                      <Icon size={19} className="shrink-0" />
                      <span className="flex-1 text-[15px] font-semibold">{item.label}</span>
                      <ChevronDown size={16} className={`shrink-0 transition-transform duration-200 ${groupOpen ? "rotate-180" : ""}`} />
                    </button>

                    <div className={`overflow-hidden transition-all duration-300 ${groupOpen ? "max-h-60 opacity-100" : "max-h-0 opacity-0"}`}>
                      <div className="ml-5 mt-1 mb-1 border-l-2 border-slate-300/50 dark:border-slate-700/50 pl-3 space-y-1">
                        {item.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={close}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[14px]
                                        transition-all duration-150
                                        ${isActiveHref(child.href)
                                          ? "bg-[#1378b7] text-white font-semibold shadow-sm"
                                          : "text-slate-900 dark:text-slate-400 hover:bg-white/40 dark:hover:bg-slate-700/40 hover:text-[#1378b7] dark:hover:text-cyan-400"
                                        }`}
                          >
                            <ChevronRight size={13} className="shrink-0 opacity-60" />
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <Link
                    href={item.href}
                    onClick={close}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl
                                text-[15px] font-semibold transition-all duration-200
                                ${isActiveHref(item.href)
                                  ? "bg-gradient-to-r from-[#1378b7] to-[#1e90d8] text-white shadow-md shadow-[#1378b7]/30"
                                  : "text-slate-900 dark:text-slate-300 hover:bg-white/40 dark:hover:bg-slate-700/40 hover:text-black dark:hover:text-white"
                                }`}
                  >
                    <Icon size={19} className="shrink-0" />
                    <span className="flex-1">{item.label}</span>
                  </Link>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/20 dark:border-slate-700/30">
          <div className="flex items-center justify-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <p className="text-[11px] text-slate-500 dark:text-slate-600 tracking-wide uppercase font-medium">
              Badan Informasi Geospasial
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}