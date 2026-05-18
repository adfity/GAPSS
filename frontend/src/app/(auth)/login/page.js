"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Lock } from "lucide-react";
import Link from "next/link";
import { FcGoogle } from "react-icons/fc";
import { SiGithub } from "react-icons/si";
import toast from "react-hot-toast";
import HeaderBar from "@/components/layout/HeaderBar";
import SideBar from "@/components/layout/sideBar";
import Footerauth from "@/components/layout/footerauth";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);

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

        document.cookie = `access_token=${data.access}; path=/; max-age=3600; SameSite=Lax`;
        document.cookie = `user_role=${data.role}; path=/; max-age=3600; SameSite=Lax`;

        toast.success("Login Berhasil!");

        if (data.role === "admin") {
          router.push("/admin/dashboard");
        } else {
          router.push("/");
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

  return (
    <div className="
      min-h-screen relative overflow-hidden
      bg-slate-100 text-slate-900
      dark:bg-slate-950 dark:text-white
    ">
      <HeaderBar />
      <SideBar />

      {/* cahaya ilahi blue */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[#1378b7]/20 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-blue-600/20 rounded-full blur-[160px]" />
      </div>

      <div className="flex items-start justify-center min-h-[calc(100vh-80px)] relative z-10 px-4 pt-26">
        <div className="w-full max-w-[500px] bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 backdrop-blur-xl rounded-3xl px-10 py-8 shadow-2xl transition-all">

          {/* title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold">Sign In</h1>
            <p className="text-slate-600 dark:text-slate-400 text-base mt-2">
              Enter your email and password to sign in!
            </p>
          </div>

          {/* social login */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <button
              onClick={() => handleSocialLogin('google')}
              className="
                flex items-center justify-center gap-3 w-full py-3 rounded-xl
                bg-slate-200 hover:bg-slate-300 text-slate-900 border border-slate-300
                dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white dark:border-white/5
                transition
              "
            >
              <FcGoogle className="w-5 h-5" />
              <span className="text-sm font-medium">Sign in with Google</span>
            </button>

            <button
              onClick={() => toast.error("Fitur GitHub belum tersedia")}
              className="
                flex items-center justify-center gap-3 w-full py-3 rounded-xl
                bg-slate-200 hover:bg-slate-300 text-slate-900 border border-slate-300
                dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white dark:border-white/5
                transition
              "
            >
              <SiGithub className="w-5 h-5" />
              <span className="text-sm font-medium">Sign in with Github</span>
            </button>
          </div>

          {/* divider */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-slate-300 dark:bg-slate-700/50" />
            <span className="text-xs text-slate-600 dark:text-slate-400 uppercase tracking-widest">Or</span>
            <div className="flex-1 h-px bg-slate-300 dark:bg-slate-700/50" />
          </div>

          {/* form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium ml-1 text-slate-700 dark:text-slate-300">Email address</label>
              <div className="relative mt-1.5">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400" size={18} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email address"
                  className="
                    w-full rounded-xl py-3 pl-12 pr-4 transition
                    bg-white border border-slate-300 text-slate-900
                    dark:bg-slate-800/60 dark:border-slate-700 dark:text-white
                    focus:ring-2 focus:ring-[#1378b7] outline-none
                  "
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium ml-1 text-slate-700 dark:text-slate-300">Password</label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400" size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="
                    w-full rounded-xl py-3 pl-12 pr-16 transition
                    bg-white border border-slate-300 text-slate-900
                    dark:bg-slate-800/60 dark:border-slate-700 dark:text-white
                    focus:ring-2 focus:ring-[#1378b7] outline-none
                  "
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#1378b7] hover:text-[#11669c]"
                >
                  {showPassword ? "HIDE" : "SHOW"}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between px-1 pt-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="accent-blue-600 w-4 h-4 rounded border-slate-300"
                />
                <span className="text-xs font-bold text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition">Keep me logged in</span>
              </label>

              <Link href="/reset-password" className="text-xs font-bold text-[#1378b7] hover:underline">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 mt-2 rounded-xl bg-[#1378b7] hover:bg-[#11669c] transition-all font-bold text-white shadow-lg shadow-[#1378b7]/20 active:scale-[0.99] disabled:opacity-70"
            >
              {loading ? 'Wait Bruh...' : 'Sign In'}
            </button>
          </form>

          {/* sign up */}
          <p className="text-center text-sm text-slate-600 dark:text-slate-400 mt-8">
            Don't have an account?{" "}
            <Link href="/register" className="text-[#1378b7] font-bold hover:underline">
              Sign Up
            </Link>
          </p>

        </div>
      </div>
      <Footerauth />
    </div>
  );
}