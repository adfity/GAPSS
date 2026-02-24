"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { MapContainer, TileLayer } from "react-leaflet";
import { useRouter } from "next/navigation";
import { User, Lock } from "lucide-react";
import Link from "next/link";
import { FcGoogle } from "react-icons/fc";
import { SiGithub } from "react-icons/si";
import "leaflet/dist/leaflet.css";
import toast from "react-hot-toast";
import HeaderBar from "@/components/layout/HeaderBar";
import Footerauth from "@/components/layout/footerauth";

export default function LoginPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/api/accounts/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("access_token", data.access);
        localStorage.setItem("refresh_token", data.refresh);
        localStorage.setItem("user_role", data.role);
        localStorage.setItem("user_name", `${data.first_name} ${data.last_name}`);
        toast.success("Login Berhasil!");
        
        if (data.role === "admin") {
          router.push("/admin/dashboard");
        } else {
          router.push("/map");
        }
      } else {
        toast.error(data.detail || "Email atau password salah!");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan koneksi ke server.");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = (provider) => {
    window.location.href = `http://127.0.0.1:8000/accounts/${provider}/login/`;
  };

  if (!mounted) return null;

  return (
    <div className="relative min-h-screen w-full overflow-hidden font-sans">
      <HeaderBar />

      {/* MAP BACKGROUND */}
      <div className="absolute inset-0 z-0">
        <MapContainer
          center={[-2.5, 118]}
          zoom={5}
          zoomControl={false}
          className="h-full w-full grayscale-[20%]"
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
        </MapContainer>
        <div className="absolute inset-0 bg-white/40 dark:bg-slate-950/60 backdrop-blur-[2px] z-10" />
      </div>

      {/* LOGIN CARD */}
      <div className="relative z-20 flex items-center justify-center min-h-screen px-4 pt-20 pb-10">
        <div className="w-full max-w-[500px] bg-white/80 dark:bg-slate-900/80 border border-white dark:border-white/10 backdrop-blur-xl rounded-[2.5rem] p-8 md:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.1)] transition-all">
          
          {/* TITLE SECTION */}
          <div className="text-center mb-10">
            <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Sign In</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 font-medium">
              Enter your email and password to sign in!
            </p>
          </div>

          {/* FORM SECTION */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2 mb-1 block">Email address</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email address"
                  className="w-full rounded-2xl py-3.5 pl-12 pr-4 bg-slate-100/50 dark:bg-slate-800/40 border-2 border-transparent focus:border-blue-500 outline-none transition-all text-sm font-semibold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2 mb-1 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-2xl py-3.5 pl-12 pr-16 bg-slate-100/50 dark:bg-slate-800/40 border-2 border-transparent focus:border-blue-500 outline-none transition-all text-sm font-semibold text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-600 dark:text-blue-400 text-[10px] font-black tracking-tighter hover:underline"
                >
                  {showPassword ? "HIDE" : "SHOW"}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between px-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="accent-blue-600 w-4 h-4 rounded border-slate-300"
                />
                <span className="text-xs font-bold text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition">Keep me logged in</span>
              </label>

              <Link href="/reset-password" title="Forgot Password" className="text-xs font-bold text-blue-600 hover:underline">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 mt-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 active:scale-[0.98] disabled:opacity-70 transition-all"
            >
              {loading ? 'Waitt Bruh...' : 'Sign In'}
            </button>
          </form>

          {/* SIGN UP SECTION */}
          <p className="text-center text-xs font-bold text-slate-500 mt-8 tracking-wide">
            Don't have an account?{" "}
            <Link href="/register" className="text-blue-600 dark:text-blue-400 hover:underline">
              Sign Up
            </Link>
          </p>

          {/* DIVIDER & SOCIAL LOGIN (DIBAWAH) */}
          <div className="mt-10">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700/50" />
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Or sign in with</span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700/50" />
            </div>

            <div className="flex justify-center gap-6">
              <button
                onClick={() => handleSocialLogin('google')}
                className="p-3 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all active:scale-90"
                title="Google"
              >
                <FcGoogle size={28}/>
              </button>

              <button
                onClick={() => toast.error("Fitur GitHub belum tersedia")}
                className="p-3 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all active:scale-90"
                title="GitHub"
              >
                <SiGithub size={28} className="text-slate-900 dark:text-white" />
              </button>
            </div>
          </div>

        </div>
      </div>
      <Footerauth />
    </div>
  );
}