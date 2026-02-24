"use client";

export default function Loading() {
  return (
    <div className="loading-container">
      <div className="earth-wrapper">
        <div className="earth"></div>
        <div className="orbit"></div>
      </div>
      <p className="loading-text">Memuat TerraSeg...</p>

      <style jsx>{`
        .loading-container {
          position: fixed;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at 20% 20%, #0b0f1a, #02040a 70%);
          overflow: hidden;
          z-index: 9999;
        }

        /* Bintang background */
        .loading-container::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image:
            radial-gradient(2px 2px at 20% 30%, white, transparent),
            radial-gradient(1.5px 1.5px at 70% 40%, white, transparent),
            radial-gradient(1.5px 1.5px at 40% 80%, white, transparent),
            radial-gradient(2px 2px at 80% 20%, white, transparent),
            radial-gradient(1px 1px at 10% 70%, white, transparent);
          opacity: 0.6;
          animation: twinkle 4s infinite ease-in-out;
        }

        @keyframes twinkle {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.9; }
        }

        .earth-wrapper {
          position: relative;
          width: 140px;
          height: 140px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Bumi */
        .earth {
          width: 110px;
          height: 110px;
          border-radius: 50%;
          background: url("https://upload.wikimedia.org/wikipedia/commons/9/97/The_Earth_seen_from_Apollo_17.jpg")
            center/cover no-repeat;
          box-shadow: 0 0 40px rgba(0, 150, 255, 0.4);
          animation: rotateEarth 12s linear infinite;
        }

        /* Orbit glow */
        .orbit {
          position: absolute;
          width: 140px;
          height: 140px;
          border-radius: 50%;
          border: 1px solid rgba(0, 200, 255, 0.25);
          animation: spin 8s linear infinite;
        }

        @keyframes rotateEarth {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        @keyframes spin {
          0% {
            transform: rotate(0deg) scale(1);
            opacity: 0.6;
          }
          50% {
            transform: rotate(180deg) scale(1.05);
            opacity: 1;
          }
          100% {
            transform: rotate(360deg) scale(1);
            opacity: 0.6;
          }
        }

        .loading-text {
          margin-top: 24px;
          font-size: 16px;
          color: #cfe9ff;
          letter-spacing: 1px;
          font-weight: 500;
          text-shadow: 0 0 10px rgba(0, 180, 255, 0.5);
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 0.6;
          }
          50% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}