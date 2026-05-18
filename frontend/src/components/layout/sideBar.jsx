"use client";

import { useState, useEffect, useRef, useMemo } from "react";

import Link from "next/link";
import Image from "next/image";

import { usePathname } from "next/navigation";

import {
    Home,
    Users,
    Utensils,
    TreePine,
    BarChart3,
    ChevronsLeft,
} from "lucide-react";


// =========================
// NOTIFY HEADERBAR
// =========================
const notifyHeaderbar = (isOpen) => {
    setTimeout(() => {
        window.dispatchEvent(
            new CustomEvent("sidebar-state", {
                detail: { isOpen },
            })
        );
    }, 0);
};


// =========================
// SIDEBAR
// =========================
export default function SideBar() {

    const pathname = usePathname();

    const [isOpen, setIsOpen] = useState(false);

    const [userRole, setUserRole] = useState(null);

    const sidebarRef = useRef(null);


    // =========================
    // GET USER ROLE
    // =========================
    useEffect(() => {

        const role = localStorage.getItem("user_role");

        setUserRole(role);

    }, []);


    // =========================
    // DYNAMIC MENU ITEMS
    // =========================
    const menuItems = useMemo(() => {

        let prefix = "";

        // USER
        if (userRole === "user") {
            prefix = "/control_center";
        }

        // ADMIN
        else if (userRole === "admin") {
            prefix = "/admin";
        }

        // GUEST
        else {
            prefix = "";
        }

        return [

            {
                label: "Home",
                icon: Home,
                href: "/",
                color: "#60a5fa",
            },

            {
                label: "SDM Nasional",
                icon: Users,
                href: `${prefix}/analisis/sdm`,
                color: "#a78bfa",
            },

            {
                label: "Ketahanan Pangan",
                icon: Utensils,
                href: `${prefix}/analisis/pangan`,
                color: "#34d399",
            },

            {
                label: "Sumber Kekayaan Alam",
                icon: TreePine,
                href: `${prefix}/analisis/iska`,
                color: "#38bdf8",
            },

            {
                label: "Pertumbuhan Ekonomi",
                icon: BarChart3,
                href: `${prefix}/analisis/ipe`,
                color: "#fbbf24",
            },
        ];

    }, [userRole]);


    // =========================
    // TOGGLE SIDEBAR
    // =========================
    useEffect(() => {

        const onToggle = () => {

            setIsOpen((prev) => {

                const next = !prev;

                notifyHeaderbar(next);

                return next;
            });
        };

        window.addEventListener(
            "toggle-sidebar",
            onToggle
        );

        return () => {

            window.removeEventListener(
                "toggle-sidebar",
                onToggle
            );
        };

    }, []);


    // =========================
    // CLOSE WHEN CLICK OUTSIDE
    // =========================
    useEffect(() => {

        const handleOutside = (e) => {

            if (
                isOpen &&
                sidebarRef.current &&
                !sidebarRef.current.contains(e.target)
            ) {

                setIsOpen(false);

                notifyHeaderbar(false);
            }
        };

        document.addEventListener(
            "mousedown",
            handleOutside
        );

        return () => {

            document.removeEventListener(
                "mousedown",
                handleOutside
            );
        };

    }, [isOpen]);


    // =========================
    // CLOSE SIDEBAR
    // =========================
    const close = () => {

        setIsOpen(false);

        notifyHeaderbar(false);
    };


    // =========================
    // ACTIVE ROUTE
    // =========================
    const isActiveHref = (href) => {

        return (
            pathname === href ||
            pathname?.startsWith(href + "/")
        );
    };


    return (
        <>

            {/* =========================
                BACKDROP
            ========================= */}
            <div
                onClick={close}
                className={`
                    fixed inset-0 z-[1250]

                    bg-black/20
                    backdrop-blur-[2px]

                    transition-all duration-300

                    ${
                        isOpen
                            ? "opacity-100 pointer-events-auto"
                            : "opacity-0 pointer-events-none"
                    }
                `}
            />


            {/* =========================
                SIDEBAR PANEL
            ========================= */}
            <aside
                ref={sidebarRef}
                className={`
                    fixed top-0 left-0 h-full z-[1300]

                    w-[260px]
                    flex flex-col

                    bg-white/60
                    dark:bg-slate-900/60

                    backdrop-blur-xl

                    border-r border-white/20
                    dark:border-slate-700/30

                    shadow-2xl shadow-black/10

                    transition-transform duration-300 ease-in-out

                    ${
                        isOpen
                            ? "translate-x-0"
                            : "-translate-x-full"
                    }
                `}
            >

                {/* =========================
                    HEADER
                ========================= */}
                <div
                    className="
                        flex items-center justify-between

                        px-5 h-[60px]

                        border-b border-white/20
                        dark:border-slate-700/30
                    "
                >

                    {/* LOGO */}
                    <Link
                        href="/"
                        onClick={close}
                        className="
                            flex items-center
                            hover:opacity-85
                            transition-opacity
                        "
                    >
                        <Image
                            src="/icons/GAPSS.png"
                            alt="GAPSS"
                            width={100}
                            height={40}
                        />
                    </Link>


                    {/* CLOSE BUTTON */}
                    <button
                        onClick={close}
                        aria-label="Tutup Sidebar"
                        className="
                            flex items-center gap-1.5

                            px-3 py-2
                            rounded-lg

                            bg-[#1378b7]/10
                            hover:bg-[#1378b7]/20

                            dark:bg-[#1378b7]/20
                            dark:hover:bg-[#1378b7]/30

                            text-[#1378b7]
                            dark:text-cyan-400

                            transition-all duration-200
                            group
                        "
                    >
                        <ChevronsLeft
                            size={18}
                            strokeWidth={4}
                            className="
                                group-hover:-translate-x-0.5
                                transition-transform
                            "
                        />
                    </button>
                </div>


                {/* =========================
                    NAVIGATION
                ========================= */}
                <nav
                    className="
                        flex-1 overflow-y-auto

                        py-4 px-3

                        custom-scrollbar

                        space-y-1
                    "
                >

                    {menuItems.map((item, idx) => {

                        const Icon = item.icon;

                        const isActive = isActiveHref(
                            item.href
                        );

                        return (
                            <Link
                                key={idx}
                                href={item.href}
                                onClick={close}
                                className={`
                                    flex items-center gap-3

                                    px-4 py-3
                                    rounded-xl

                                    text-[14px]
                                    font-semibold

                                    transition-all duration-200

                                    ${
                                        isActive
                                            ? `
                                                bg-gradient-to-r
                                                from-[#1378b7]
                                                to-[#1e90d8]

                                                text-white

                                                shadow-md
                                                shadow-[#1378b7]/30
                                            `
                                            : `
                                                text-slate-700
                                                dark:text-slate-300

                                                hover:bg-white/50
                                                dark:hover:bg-slate-700/50

                                                hover:text-black
                                                dark:hover:text-white
                                            `
                                    }
                                `}
                            >

                                {/* ICON */}
                                <div
                                    className="
                                        w-8 h-8
                                        rounded-lg

                                        flex items-center
                                        justify-center

                                        shrink-0
                                    "
                                    style={{
                                        background: isActive
                                            ? "rgba(255,255,255,0.2)"
                                            : `${item.color}22`,
                                    }}
                                >

                                    <Icon
                                        size={16}
                                        strokeWidth={2}
                                        style={{
                                            color: isActive
                                                ? "white"
                                                : item.color,
                                        }}
                                    />
                                </div>


                                {/* LABEL */}
                                <span className="flex-1">
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </nav>


                {/* =========================
                    FOOTER
                ========================= */}
                <div
                    className="
                        px-5 py-4

                        border-t border-white/30
                        dark:border-slate-700/40

                        mt-auto
                    "
                >
                    <div
                        className="
                            flex items-center
                            justify-center
                            gap-2
                        "
                    >

                        {/* STATUS DOT */}
                        <div
                            className="
                                w-1.5 h-1.5
                                rounded-full

                                bg-emerald-500
                                dark:bg-emerald-400

                                shadow-[0_0_4px_#10b981]
                                dark:shadow-[0_0_6px_#34d399]
                            "
                        />

                        {/* TEXT */}
                        <p
                            className="
                                text-[11px]
                                font-medium
                                tracking-wide
                                uppercase

                                text-gray-600
                                dark:text-gray-400
                            "
                        >
                            Badan Informasi Geospasial
                        </p>

                    </div>
                </div>

            </aside>
        </>
    );
}