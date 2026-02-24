"use client";
import { useEffect, useRef } from "react";

export default function NotFound() {
  const starsRef = useRef(null);

  useEffect(() => {
    const starsContainer = starsRef.current;

    // generate random stars
    for (let i = 0; i < 120; i++) {
      const star = document.createElement("div");
      star.className = "star";
      star.style.top = Math.random() * 100 + "vh";
      star.style.left = Math.random() * 100 + "vw";
      star.style.animationDelay = Math.random() * 3 + "s";
      star.style.opacity = Math.random();
      starsContainer.appendChild(star);
    }

    // glitch effect 404
    const interval = setInterval(() => {
      const el = document.getElementById("errorText");
      if (el) {
        el.style.textShadow = `
          ${Math.random() * 5}px ${Math.random() * 5}px 10px rgba(56,189,248,0.7),
          ${Math.random() * -5}px ${Math.random() * 5}px 10px rgba(34,197,94,0.7)
        `;
      }
    }, 300);

    return () => clearInterval(interval);
  }, []);

  const goHome = () => {
    window.location.href = "/";
  };

  return (
    <div className="page">
      {/* Stars Background */}
      <div className="stars" ref={starsRef}></div>

      {/* Shooting Stars */}
      <div className="shooting-star s1"></div>
      <div className="shooting-star s2"></div>
      <div className="shooting-star s3"></div>

      {/* Glow circles (from your original) */}
      <div className="circle circle1"></div>
      <div className="circle circle2"></div>

      <div className="container">
        <div className="planet">🌍</div>
        <div className="error-code" id="errorText">404</div>
        <div className="title">Halaman Tidak Ditemukan</div>
        <div className="desc">
          Sepertinya halaman yang kamu cari hilang di luar angkasa.
        </div>
        <button className="btn-home" onClick={goHome}>
          Kembali ke Beranda
        </button>
      </div>

      <style jsx>{`
        .page {
          height: 100vh;
          background: radial-gradient(ellipse at bottom, #020617 0%, #000000 100%);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          font-family: "Segoe UI", sans-serif;
          position: relative;
        }

        .container {
          text-align: center;
          z-index: 2;
          padding: 20px;
        }

        .error-code {
          font-size: 150px;
          font-weight: 800;
          letter-spacing: 10px;
          background: linear-gradient(90deg, #38bdf8, #22c55e);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: float 3s ease-in-out infinite;
        }

        .title {
          font-size: 32px;
          margin-top: -20px;
          margin-bottom: 10px;
          font-weight: 600;
        }

        .desc {
          color: #94a3b8;
          font-size: 16px;
          margin-bottom: 30px;
        }

        .btn-home {
          padding: 12px 28px;
          border-radius: 999px;
          border: none;
          background: linear-gradient(90deg, #38bdf8, #22c55e);
          color: white;
          font-size: 16px;
          cursor: pointer;
          transition: 0.3s ease;
          box-shadow: 0 10px 25px rgba(34, 197, 94, 0.3);
        }

        .btn-home:hover {
          transform: translateY(-3px) scale(1.05);
          box-shadow: 0 15px 35px rgba(56, 189, 248, 0.4);
        }

        /* Stars */
        .stars {
          position: absolute;
          width: 100%;
          height: 100%;
          z-index: 0;
        }

        .star {
          position: absolute;
          width: 2px;
          height: 2px;
          background: white;
          border-radius: 50%;
          animation: twinkle 3s infinite ease-in-out;
        }

        @keyframes twinkle {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }

        /* Shooting stars */
        .shooting-star {
          position: absolute;
          top: -50px;
          width: 3px;
          height: 120px;
          background: linear-gradient(-45deg, white, rgba(255,255,255,0));
          transform: rotate(45deg);
          opacity: 0.8;
          animation: shooting 6s linear infinite;
          z-index: 1;
        }

        .s1 { left: 80%; animation-delay: 0s; }
        .s2 { left: 60%; animation-delay: 2s; }
        .s3 { left: 40%; animation-delay: 4s; }

        @keyframes shooting {
          0% {
            transform: translateX(0) translateY(0) rotate(45deg);
            opacity: 0;
          }
          10% { opacity: 1; }
          100% {
            transform: translateX(-1200px) translateY(1200px) rotate(45deg);
            opacity: 0;
          }
        }

        /* Glow circles (original design preserved) */
        .circle {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.3;
          animation: move 12s infinite alternate ease-in-out;
          z-index: 0;
        }

        .circle1 {
          width: 300px;
          height: 300px;
          background: #38bdf8;
          top: 10%;
          left: 10%;
        }

        .circle2 {
          width: 250px;
          height: 250px;
          background: #22c55e;
          bottom: 10%;
          right: 10%;
          animation-delay: 2s;
        }

        .planet {
          font-size: 60px;
          margin-bottom: 10px;
          animation: spin 20s linear infinite;
          display: inline-block;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }

        @keyframes move {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(40px, -40px) scale(1.1); }
        }

        @media (max-width: 600px) {
          .error-code { font-size: 100px; }
          .title { font-size: 24px; }
        }
      `}</style>
    </div>
  );
}