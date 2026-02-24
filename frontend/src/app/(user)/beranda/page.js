'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect } from 'react';
import '@/styles/utilities.css';
import '@/styles/components.css';
import '@/styles/public.css';
import HeaderBar from "@/components/layout/HeaderBar";
import Footerauth from "@/components/layout/footerauth";
import HeroSection from "@/components/sections/publik/hero";
import FeaturesSection from "@/components/sections/publik/feature";
import WorkflowSection from "@/components/sections/publik/workflow";

export default function HomePage() {
  useEffect(() => {
    // Smooth scroll untuk navigasi
    const handleAnchorClick = (e) => {
      const target = e.target.closest('a');
      if (target && target.getAttribute('href')?.startsWith('#')) {
        e.preventDefault();
        const targetId = target.getAttribute('href');
        const targetElement = document.querySelector(targetId);
        
        if (targetElement) {
          window.scrollTo({
            top: targetElement.offsetTop - 80,
            behavior: 'smooth'
          });
        }
      }
    };

    document.addEventListener('click', handleAnchorClick);

    // Scroll animation untuk sections
    const sections = document.querySelectorAll('.section-hidden');
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('section-visible');
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -100px 0px'
    });
    
    sections.forEach(section => {
      observer.observe(section);
    });

    return () => {
      document.removeEventListener('click', handleAnchorClick);
    };
  }, []);

  return (
    <div className="
      min-h-screen relative overflow-hidden
            bg-slate-100 text-slate-900ds
            dark:bg-slate-950 dark:text-white
    ">
    {/* Header */}
      <HeaderBar />

    {/* Section */}
      <HeroSection />
      <FeaturesSection />
      <WorkflowSection />

      {/* Footer */}
      <Footerauth />
    </div>
  );
}