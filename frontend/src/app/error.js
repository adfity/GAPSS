"use client";
import { useEffect, useRef } from "react";

export default function ErrorPage({ error, reset }) {
  const starsRef = useRef(null);

  useEffect(() => {
    const starsContainer = starsRef.current;

    if (!starsContainer) return;

    for (let i = 0; i < 120; i++) {
      const star = document.createElement("div");
      star.classList.add("star");
      star.style.top = Math.random() * 100 + "vh";
      star.style.left = Math.random() * 100 + "vw";
      star.style.animationDelay = Math.random() * 3 + "s";
      star.style.opacity = Math.random();
      starsContainer.appendChild(star);
    }
  }, []);

  const goHome = () => {
    window.location.href = "/";
  };

  const reloadPage = () => {
    if (reset) {
      reset();
    } else {
      location.reload();
    }
  };

  return (
    <div className="page">
      {/* Static Stars */}
      <div className="stars" ref={starsRef}></div>

      {/* Shooting Stars */}
      <div className="shooting-star s1"></div>
      <div className="shooting-star s2"></div>
      <div className="shooting-star s3"></div>

      <div className="container">
        <div className="planet">🪐</div>
        <div className="error-code">500</div>
        <div className="title">Sistem Sedang Bermasalah</div>
        <div className="desc">
          Halaman ini tersesat di luar angkasa.<br />
          Silakan coba muat ulang atau kembali ke beranda.
        </div>

        <div className="buttons">
          <button className="btn btn-home" onClick={goHome}>
            Ke Beranda
          </button>
          <button className="btn btn-reload" onClick={reloadPage}>
            Muat Ulang
          </button>
        </div>
      </div>

      <style jsx>{`
        .page {
          height: 100vh;
          background: radial-gradient(ellipse at bottom, #020617 0%, #000000 100%);
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-family: "Segoe UI", sans-serif;
          position: relative;
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
          opacity: 0.8;
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
          opacity: 0.8;
          transform: rotate(45deg);
          animation: shooting 4s linear infinite;
          z-index: 1;
        }

        .s1 {
          left: 80%;
          animation-delay: 0s;
        }

        .s2 {
          left: 60%;
          animation-delay: 2s;
        }

        .s3 {
          left: 40%;
          animation-delay: 4s;
        }

        @keyframes shooting {
          0% {
            transform: translateX(0) translateY(0) rotate(45deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          100% {
            transform: translateX(-1200px) translateY(1200px) rotate(45deg);
            opacity: 0;
          }
        }

        .container {
          text-align: center;
          z-index: 2;
          max-width: 600px;
          padding: 20px;
        }

        .planet {
          font-size: 70px;
          margin-bottom: 15px;
          animation: float 4s ease-in-out infinite;
          display: inline-block;
        }

        .error-code {
          font-size: 120px;
          font-weight: 900;
          letter-spacing: 10px;
          background: linear-gradient(90deg, #ef4444, #f97316); /* merah → oranye */
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0 0 40px rgba(239, 68, 68, 0.5);
          animation: glowRed 2.5s ease-in-out infinite;
        }

        @keyframes glowRed {
          0%, 100% {
            text-shadow: 0 0 20px rgba(239, 68, 68, 0.3);
          }
          50% {
            text-shadow: 0 0 60px rgba(239, 68, 68, 0.9);
          }
        }

        .title {
          font-size: 32px;
          margin-top: 10px;
          font-weight: 600;
        }

        .desc {
          margin-top: 10px;
          color: #94a3b8;
          font-size: 16px;
          line-height: 1.6;
          margin-bottom: 35px;
        }

        .buttons {
          display: flex;
          gap: 15px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .btn {
          padding: 12px 28px;
          border-radius: 999px;
          border: none;
          font-size: 15px;
          cursor: pointer;
          transition: 0.3s ease;
        }

        .btn-home {
          background: linear-gradient(90deg, #38bdf8, #22c55e);
          color: white;
          box-shadow: 0 10px 30px rgba(56, 189, 248, 0.4);
        }

        .btn-home:hover {
          transform: translateY(-3px) scale(1.05);
        }

        .btn-reload {
          background: transparent;
          border: 1px solid #334155;
          color: #cbd5f5;
        }

        .btn-reload:hover {
          border-color: #38bdf8;
          color: #38bdf8;
          background: rgba(15, 23, 42, 0.5);
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }

        @keyframes glow {
          0%, 100% { text-shadow: 0 0 20px rgba(56,189,248,0.3); }
          50% { text-shadow: 0 0 60px rgba(56,189,248,0.8); }
        }

        @media (max-width: 600px) {
          .error-code { font-size: 80px; }
          .title { font-size: 24px; }
          .planet { font-size: 50px; }
        }
      `}</style>
    </div>
  );
}