"use client";

/**
 * Auth layout — shared split-screen layout for login, register, and
 * forgot-password.
 *
 * Premium redesign:
 *  - Better spacing and typography
 *  - More refined brand panel
 *  - Subtle animations
 *  - Better visual hierarchy
 */

import * as React from "react";
import { motion } from "framer-motion";
import { Logo } from "@/components/brand/logo";

export function AuthLayout({
  children,
  title,
  description,
}: {
  children: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="min-h-screen flex bg-background">
      {/* Left: form */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-10 lg:px-16 py-12 max-w-md mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="mb-8">
            <a href="#/" className="inline-flex items-center gap-2 group">
              <Logo withWordmark={false} size={24} />
              <span className="text-[15px] font-bold text-foreground tracking-tight">
                Leadforge
              </span>
            </a>
          </div>
          <div className="mb-8">
            <h1 className="text-[26px] font-bold tracking-tight text-foreground leading-tight">
              {title}
            </h1>
            <p className="mt-2 text-[13.5px] text-muted-foreground leading-relaxed">
              {description}
            </p>
          </div>
          {children}
        </motion.div>
      </div>

      {/* Right: brand panel (desktop only) */}
      <div className="hidden lg:flex flex-1 relative items-center justify-center px-10 border-l border-border/60 bg-sidebar overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-background/90" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
          className="relative max-w-sm text-center"
        >
          <div className="w-14 h-14 rounded-2xl mx-auto mb-6 flex items-center justify-center bg-foreground/5 border border-foreground/10">
            <Logo withWordmark={false} size={28} />
          </div>
          <p className="text-[17px] font-medium text-foreground leading-relaxed mb-3">
            "The first lead platform that respects your infrastructure."
          </p>
          <p className="text-[12.5px] text-muted-foreground leading-relaxed">
            Self-hosted on Docker Compose. PostgreSQL as the single source of truth.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
