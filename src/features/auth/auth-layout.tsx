"use client";

/**
 * Auth layout — shared split-screen layout for login, register, and
 * forgot-password. Left half: form. Right half: brand panel with a
 * subtle gradient grid background.
 *
 * On mobile, the brand panel is hidden and the form takes the full screen.
 */

import * as React from "react";
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
        <div className="mb-8">
          <a href="#/">
            <Logo />
          </a>
        </div>
        <div className="mb-8">
          <h1 className="text-[24px] font-semibold tracking-tight text-foreground leading-tight">
            {title}
          </h1>
          <p className="mt-1.5 text-[13.5px] text-muted-foreground leading-relaxed">
            {description}
          </p>
        </div>
        {children}
      </div>

      {/* Right: brand panel (desktop only) */}
      <div className="hidden lg:flex flex-1 relative items-center justify-center px-10 border-l border-border/60 bg-sidebar overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-background/80" />
        <div className="relative max-w-sm text-center">
          <div className="w-12 h-12 rounded-lg mx-auto mb-5 flex items-center justify-center bg-foreground/5 border border-foreground/10">
            <Logo withWordmark={false} size={28} />
          </div>
          <p className="text-[16px] font-medium text-foreground leading-relaxed mb-2">
            "The first lead platform that respects your infrastructure."
          </p>
          <p className="text-[12.5px] text-muted-foreground">
            Self-hosted on Docker Compose. PostgreSQL as the single source of truth.
          </p>
        </div>
      </div>
    </div>
  );
}
