"use client";
import { useEffect, useState } from "react";
import { Sun, Moon, LogOut, User as UserIcon, ChevronDown, Users, Utensils, TreePine, BarChart3 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import toast from 'react-hot-toast';

export default function HeaderBar() {
    const router = useRouter();
    const pathname = usePathname();
    const isLandingPage = pathname === "/";
    const isAnalysisPage = pathname?.startsWith("/analisis");
    
    const [theme, setTheme] = useState("light");
    const [activeHash, setActiveHash] = useState("#home");
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userName, setUserName] = useState("");
    const [showAnalysisDropdown, setShowAnalysisDropdown] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem("access_token");
        const name = localStorage.getItem("user_name");
        setIsLoggedIn(!!token);
        setUserName(name || "User");
    }, [pathname]);

    useEffect(() => {
        const saved = localStorage.getItem("theme") || "light";
        document.documentElement.setAttribute("data-theme", saved);
        setTheme(saved);
    }, []);

    // Netflix-style scroll effect - detect map movement
    useEffect(() => {
        let scrollTimeout;
        let isUserInteracting = false;

        const handleMapInteraction = () => {
            if (!isUserInteracting) {
                isUserInteracting = true;
                setIsScrolled(true);
            }

            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                isUserInteracting = false;
                setIsScrolled(false);
            }, 2000); // Kembali transparan setelah 2 detik tidak ada interaksi
        };

        // Detect scroll on window
        const handleScroll = () => {
            if (window.scrollY > 10) {
                setIsScrolled(true);
            } else {
                setIsScrolled(false);
            }
        };

        // Detect mouse movement and interactions
        const handleMouseMove = () => {
            handleMapInteraction();
        };

        const handleMouseDown = () => {
            handleMapInteraction();
        };

        const handleWheel = () => {
            handleMapInteraction();
        };

        window.addEventListener('scroll', handleScroll);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('wheel', handleWheel);

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('wheel', handleWheel);
            clearTimeout(scrollTimeout);
        };
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showAnalysisDropdown && !event.target.closest('.dropdown-container')) {
                setShowAnalysisDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showAnalysisDropdown]);

    useEffect(() => {
        if (!isLandingPage) return;
        const sections = ["home", "features", "how-it-works", "cta"];
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setActiveHash(`#${entry.target.id}`);
                    }
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
        const logoutToast = toast.loading('Signing out...');
        setTimeout(() => {
            localStorage.clear();
            setIsLoggedIn(false);
            toast.success(`Goodbye, ${userName}!`, { id: logoutToast, icon: '👋' });
            setTimeout(() => router.push("/"), 500);
        }, 800);
    };

    // Data Menu Analisis Terstruktur
    const analysisMenus = [
        {
            category: "SDM Nasional",
            icon: <Users size={14} />,
            tech: "NoSQL Analysis",
            type: "dropdown",
            items: [
                { href: "/analisis/ekonomi", label: "Ekonomi" },
                { href: "/analisis/pendidikan", label: "Pendidikan" },
                { href: "/analisis/kesehatan", label: "Kesehatan" },
            ]
        },
        {
            category: "Ketahanan Pangan",
            icon: <Utensils size={14} />,
            tech: "Spasial GeoAI",
            type: "link",
            href: "/analisis/pangan"
        },
        {
            category: "Sumber Kekayaan Alam",
            icon: <TreePine size={14} />,
            tech: "Spasial GeoAI",
            type: "link",
            href: "/analisis/sda"
        },
        {
            category: "Pertumbuhan Ekonomi",
            icon: <BarChart3 size={14} />,
            tech: "Big Data Analysis",
            type: "link",
            href: "/analisis/pertumbuhan-ekonomi"
        }
    ];

    return (
        <header className={`fixed top-0 left-0 right-0 h-16 z-[1200] flex items-center px-4 md:px-5 transition-all duration-300 ${
            isScrolled 
                ? 'bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-lg' 
                : 'backdrop-blur-md bg-white/20 dark:bg-slate-900/10 border-b border-slate-200/50 dark:border-slate-800/50'
        }`}>
            
            <Link href="/" className="flex items-center hover:opacity-90 transition pl-2 md:pl-5">
                <Image src="/icons/bterra.png" alt="TerraSeg" width={90} height={36} className="block dark:hidden" />
                <Image src="/icons/wterra.png" alt="TerraSeg" width={90} height={36} className="hidden dark:block" />
            </Link>

            {isLandingPage ? (
                <nav className="hidden md:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-gradient-to-r from-slate-50 to-slate-100/80 dark:from-slate-800 dark:to-slate-800/80 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50">
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
                                className={`px-5 py-2 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap ${
                                    activeHash === item.href 
                                    ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/40 scale-105" 
                                    : "text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white hover:shadow-md"
                                }`}
                            >
                                {item.label}
                            </a>
                        ))}
                    </div>
                </nav>
            ) : (
                <nav className="hidden md:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-gradient-to-r from-slate-50 to-slate-100/80 dark:from-slate-800 dark:to-slate-800/80 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50">
                        <Link 
                            href="/beranda"
                            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap ${
                                pathname === "/" 
                                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/40 scale-105" 
                                : "text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white hover:shadow-md"
                            }`}
                        >
                            Home
                        </Link>
                        
                        <Link 
                            href="/map"
                            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap ${
                                pathname === "/map" 
                                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/40 scale-105" 
                                : "text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white hover:shadow-md"
                            }`}
                        >
                            Map
                        </Link>

                        <div className="relative dropdown-container">
                            <button
                                onClick={() => setShowAnalysisDropdown(!showAnalysisDropdown)}
                                className={`px-5 py-2 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap flex items-center gap-1 ${
                                    isAnalysisPage || showAnalysisDropdown
                                    ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/40 scale-105" 
                                    : "text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white hover:shadow-md"
                                }`}
                            >
                                Analisis
                                <ChevronDown size={16} className={`transition-transform duration-300 ${showAnalysisDropdown ? 'rotate-180' : ''}`} />
                            </button>

                            {showAnalysisDropdown && (
                                <div className="absolute top-full mt-3 left-0 w-[280px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="p-2 flex flex-col gap-1">
                                        {analysisMenus.map((menu, idx) => (
                                            <div key={idx} className="group">
                                                {menu.type === "dropdown" ? (
                                                    <div className="flex flex-col">
                                                        <div className="px-4 py-3 flex flex-col border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-800/30 rounded-t-xl">
                                                            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                                                                {menu.icon}
                                                                {menu.category}
                                                            </div>
                                                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 ml-5 uppercase">{menu.tech}</span>
                                                        </div>
                                                        <div className="flex flex-col gap-1 p-1 bg-slate-50/30 dark:bg-slate-800/10 rounded-b-xl mb-2">
                                                            {menu.items.map((sub) => (
                                                                <Link 
                                                                    key={sub.href}
                                                                    href={sub.href}
                                                                    onClick={() => setShowAnalysisDropdown(false)}
                                                                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${pathname === sub.href ? "bg-cyan-500 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 hover:text-cyan-600 dark:hover:text-cyan-400"}`}
                                                                >
                                                                    {sub.label}
                                                                </Link>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <Link 
                                                        href={menu.href}
                                                        onClick={() => setShowAnalysisDropdown(false)}
                                                        className={`flex flex-col px-4 py-3 rounded-xl transition-all mb-1 ${pathname === menu.href ? "bg-cyan-500 text-white shadow-md" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}
                                                    >
                                                        <div className={`flex items-center gap-2 text-[11px] font-black uppercase tracking-wider ${pathname === menu.href ? "text-white" : "text-slate-700 dark:text-slate-200"}`}>
                                                            {menu.icon}
                                                            {menu.category}
                                                        </div>
                                                        <span className={`text-[9px] font-bold ml-5 uppercase ${pathname === menu.href ? "text-cyan-100" : "text-slate-400 dark:text-slate-500"}`}>
                                                            {menu.tech}
                                                        </span>
                                                    </Link>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </nav>
            )}

            <div className="ml-auto flex items-center gap-2 md:gap-3 pr-2 md:pr-5">
                <button 
                    onClick={toggleTheme} 
                    className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                    {theme === "dark" ? (
                        <Sun size={20} className="text-yellow-400" />
                    ) : (
                        <Moon size={20} className="text-slate-700" />
                    )}
                </button>

                {isLoggedIn ? (
                    <div className="flex items-center gap-1 md:gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div className="hidden sm:flex items-center gap-2 px-2 md:px-3 py-1">
                            <div className="w-7 h-7 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white">
                                <UserIcon size={14} />
                            </div>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200 max-w-[100px] truncate">
                                {userName}
                            </span>
                        </div>
                        <button onClick={handleSignOut} className="h-8 w-8 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition flex items-center justify-center">
                            <LogOut size={16} />
                        </button>
                    </div>
                ) : (
                    <button onClick={() => router.push("/login")} className="h-9 md:h-10 px-4 md:px-5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 shadow-md font-bold text-white text-sm transition active:scale-95">
                        Login
                    </button>
                )}
            </div>
        </header>
    );
}