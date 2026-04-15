"use client";
import { useEffect, useState, useRef } from "react";
import { Sun, Moon, LogOut, ChevronDown, ChevronUp, UserCog } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import toast from 'react-hot-toast';

export default function HeaderBar() {
    const router = useRouter();
    const pathname = usePathname();
    const isLandingPage = pathname === "/";

    const [theme, setTheme] = useState("light");
    const [activeHash, setActiveHash] = useState("#home");
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userName, setUserName] = useState("");
    const [userEmail, setUserEmail] = useState("");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const dropdownRef = useRef(null);

    useEffect(() => {
        const token = localStorage.getItem("access_token");
        const name  = localStorage.getItem("user_name");
        const email = localStorage.getItem("user_email");
        setIsLoggedIn(!!token);
        setUserName(name || "User");
        setUserEmail(email || "");
    }, [pathname]);

    useEffect(() => {
        const saved = localStorage.getItem("theme") || "light";
        document.documentElement.setAttribute("data-theme", saved);
        setTheme(saved);
    }, []);

    useEffect(() => {
        const onSidebarChange = (e) => {
            setTimeout(() => setSidebarOpen(e.detail.isOpen), 0);
        };
        window.addEventListener("sidebar-state", onSidebarChange);
        return () => window.removeEventListener("sidebar-state", onSidebarChange);
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        const handleOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleOutside);
        return () => document.removeEventListener("mousedown", handleOutside);
    }, []);

    useEffect(() => {
        if (!isLandingPage) return;
        const sections = ["home", "features", "how-it-works", "cta"];
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) setActiveHash(`#${entry.target.id}`);
                });
            },
            { rootMargin: "-30% 0px -50% 0px", threshold: 0.05 }
        );
        sections.forEach((id) => {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        });
        return () => observer.disconnect();
    }, [isLandingPage]);

    const toggleTheme = () => {
        const next = theme === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
        localStorage.setItem("theme", next);
        setTheme(next);
    };

    const handleSignOut = () => {
        setDropdownOpen(false);
        const logoutToast = toast.loading('Signing out...');
        setTimeout(() => {
            localStorage.clear();
            setIsLoggedIn(false);
            toast.success(`Goodbye, ${userName}!`, { id: logoutToast, icon: '👋' });
            setTimeout(() => router.push("/"), 500);
        }, 800);
    };

    const handleToggleSidebar = () => {
        window.dispatchEvent(new CustomEvent("toggle-sidebar"));
    };

    // Get initials for avatar fallback
    const getInitials = (name) => {
        return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    };

    return (
        <header className="
            fixed top-0 left-0 right-0 h-[60px] z-[1000]
            flex items-center
            bg-white/30 dark:bg-slate-900/30
            backdrop-blur-md
            border-b border-white/20 dark:border-slate-700/30
        ">
            {/* ── Logo ── */}
            <div className="flex items-center h-full px-5 border-r border-white/20 dark:border-slate-700/30 shrink-0">
                <Link href="/" className="flex items-center hover:opacity-85 transition-opacity">
                    <Image src="/icons/GAPSS.png" alt="Synap" width={100} height={40} />
                </Link>
            </div>

            {/* ── Hamburger — non-landing pages only ── */}
            {!isLandingPage && (
                <button
                    onClick={handleToggleSidebar}
                    aria-label={sidebarOpen ? "Tutup Menu" : "Buka Menu"}
                    className="
                        ml-5 flex flex-col justify-center items-center gap-[5.5px]
                        w-9 h-9 rounded-lg shrink-0
                        text-black dark:text-slate-300
                        hover:bg-white/40 dark:hover:bg-slate-700/40
                        transition-all duration-200
                    "
                >
                    <span className={`block h-[2.5px] w-[22px] rounded-full bg-current transition-all duration-300 origin-center ${sidebarOpen ? "rotate-45 translate-y-[8px]" : ""}`} />
                    <span className={`block h-[2.5px] w-[22px] rounded-full bg-current transition-all duration-300 ${sidebarOpen ? "opacity-0 scale-x-0" : ""}`} />
                    <span className={`block h-[2.5px] w-[22px] rounded-full bg-current transition-all duration-300 origin-center ${sidebarOpen ? "-rotate-45 -translate-y-[8px]" : ""}`} />
                </button>
            )}

            {/* ── Center Nav — landing page only ── */}
            {isLandingPage && (
                <nav className="hidden md:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div className="flex items-center gap-1 px-3 py-2 rounded-2xl bg-white/40 dark:bg-slate-800/40 backdrop-blur-md border border-white/30 dark:border-slate-700/30 shadow-md">
                        {[
                            { href: "#home", label: "Home" },
                            { href: "#features", label: "Fitur" },
                            { href: "#how-it-works", label: "Cara Kerja" },
                            { href: "#cta", label: "Daftar" }
                        ].map(item => (
                            <a
                                key={item.href}
                                href={item.href}
                                onClick={() => setActiveHash(item.href)}
                                className={`px-5 py-2 rounded-xl text-[14px] font-bold transition-all duration-300 whitespace-nowrap ${
                                    activeHash === item.href
                                    ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/40 scale-105"
                                    : "text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700/60 hover:text-slate-900 dark:hover:text-white hover:shadow-md"
                                }`}
                            >
                                {item.label}
                            </a>
                        ))}
                    </div>
                </nav>
            )}

            {/* ── Right Actions ── */}
            <div className="ml-auto flex items-center gap-3 pr-5">

                {/* Theme toggle */}
                <button
                    onClick={toggleTheme}
                    className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white/40 dark:hover:bg-slate-700/40 transition"
                >
                    {theme === "dark"
                        ? <Sun size={21} className="text-yellow-400" />
                        : <Moon size={21} className="text-black" />
                    }
                </button>

                <div className="h-7 w-px bg-white/30 dark:bg-slate-700/50" />

                {/* User area */}
                {isLoggedIn ? (
                    <div className="relative" ref={dropdownRef}>
                        {/* Trigger button */}
                        <button
                            onClick={() => setDropdownOpen((v) => !v)}
                            className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-white/40 dark:hover:bg-slate-700/40 transition-all duration-200"
                        >
                            {/* Avatar */}
                            <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white text-[12px] font-bold shrink-0 select-none">
                                {getInitials(userName)}
                            </div>
                            <span className="hidden sm:block text-[14px] font-semibold text-slate-800 dark:text-slate-100 max-w-[90px] truncate">
                                {userName}
                            </span>
                            {dropdownOpen
                                ? <ChevronUp size={14} className="text-slate-400 hidden sm:block" />
                                : <ChevronDown size={14} className="text-slate-400 hidden sm:block" />
                            }
                        </button>

                        {/* Dropdown panel */}
                        {dropdownOpen && (
                            <div className="
                                absolute right-0 top-[calc(100%+8px)]
                                w-64 z-[2000]
                                bg-white dark:bg-slate-900
                                border border-slate-200 dark:border-slate-700/60
                                rounded-2xl shadow-2xl shadow-black/15
                                overflow-hidden
                                animate-in fade-in slide-in-from-top-2 duration-150
                            ">
                                {/* User info header */}
                                <div className="px-4 py-4 border-b border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white text-[13px] font-bold shrink-0 select-none">
                                            {getInitials(userName)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[14px] font-bold text-slate-800 dark:text-slate-100 truncate">
                                                {userName}
                                            </p>
                                            {userEmail && (
                                                <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                                                    {userEmail}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Menu items */}
                                <div className="p-2">
                                    <Link
                                        href="/profile"
                                        onClick={() => setDropdownOpen(false)}
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
                                    >
                                        <UserCog size={16} className="text-slate-400 dark:text-slate-500 shrink-0" />
                                        Edit Profile
                                    </Link>


                                </div>

                                {/* Sign out — separated */}
                                <div className="p-2 border-t border-slate-100 dark:border-slate-800">
                                    <button
                                        onClick={handleSignOut}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                    >
                                        <LogOut size={16} className="shrink-0" />
                                        Sign Out
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <button
                        onClick={() => router.push("/login")}
                        className="h-10 px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 shadow-md font-bold text-white text-[14px] transition active:scale-95"
                    >
                        Login
                    </button>
                )}
            </div>
        </header>
    );
}