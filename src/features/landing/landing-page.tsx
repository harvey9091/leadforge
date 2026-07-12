"use client";

/**
 * Landing page — the public-facing entry point.
 *
 * Designed to feel like Linear's or Vercel's landing page: dark, minimal,
 * confident. Includes the product mark, a clear value proposition, primary
 * CTAs (sign in / get started), and a feature grid.
 *
 * The "Get started" CTA navigates to /register; "Sign in" to /login.
 * If the user is already authenticated, the page silently redirects to
 * /dashboard.
 */

import * as React from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  Sparkles,
  Activity,
  Shield,
  Github,
  Server,
  Database,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/auth-provider";
import { navigate } from "@/hooks/use-hash-route";

const FEATURES = [
  {
    icon: Building2,
    title: "Discover",
    description: "Find SaaS startups across YC, Product Hunt, Hacker News, SEC EDGAR, Greenhouse, and more — no Apollo required.",
  },
  {
    icon: Database,
    title: "Enrich",
    description: "Firecrawl-powered enrichment pulls homepage, pricing, careers, and tech stack for every company.",
  },
  {
    icon: Sparkles,
    title: "Qualify",
    description: "FreeLLM-powered ICP matching, scoring, and confidence — every lead graded A through F.",
  },
  {
    icon: Activity,
    title: "Monitor",
    description: "Operational dashboard with worker health, queue depth, and audit trail. Built for SREs.",
  },
  {
    icon: Shield,
    title: "Own your data",
    description: "Fully self-hosted on Docker Compose. PostgreSQL is the single source of truth. No vendor lock-in.",
  },
  {
    icon: Server,
    title: "Production-grade",
    description: "JWT auth, RBAC, structured logging, request IDs, repository pattern, and typed end-to-end.",
  },
];

export function LandingPage() {
  const { user, booting } = useAuth();

  React.useEffect(() => {
    if (!booting && user) {
      navigate("#/dashboard");
    }
  }, [booting, user]);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Subtle grid background */}
      <div className="absolute inset-0 bg-grid mask-fade-b pointer-events-none" />

      {/* Nav */}
      <header className="relative z-10 h-16 flex items-center justify-between px-6 lg:px-10 max-w-[1200px] mx-auto">
        <Logo />
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-[13px]" onClick={() => navigate("#/login")}>
            Sign in
          </Button>
          <Button size="sm" className="text-[13px] gap-1.5" onClick={() => navigate("#/register")}>
            Get started
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 px-6 lg:px-10 max-w-[1000px] mx-auto pt-20 pb-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-card/40 backdrop-blur-sm text-[11.5px] text-muted-foreground mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            Self-hosted · Phase 1 foundation ready
          </div>
          <h1 className="text-[44px] sm:text-[56px] lg:text-[64px] font-semibold tracking-[-0.03em] leading-[1.05] text-foreground">
            Lead intelligence,
            <br />
            <span className="text-muted-foreground">without the tax.</span>
          </h1>
          <p className="mt-6 text-[15px] sm:text-[17px] text-muted-foreground max-w-[560px] mx-auto leading-relaxed">
            A self-hosted, production-grade alternative to Apollo. Discover, enrich,
            qualify, and manage SaaS startup leads — with your own infrastructure, your
            own data, and your own LLM.
          </p>
          <div className="mt-8 flex items-center justify-center gap-2">
            <Button size="lg" className="gap-1.5 h-10 px-5" onClick={() => navigate("#/register")}>
              Start exploring
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button size="lg" variant="outline" className="h-10 px-5 gap-1.5" onClick={() => navigate("#/login")}>
              <Github className="w-4 h-4" />
              Sign in
            </Button>
          </div>
          <p className="mt-3 text-[11.5px] text-muted-foreground">
            Demo account: <span className="font-mono">admin@leadforge.local</span> · <span className="font-mono">Leadforge123</span>
          </p>
        </motion.div>
      </section>

      {/* Features grid */}
      <section className="relative z-10 px-6 lg:px-10 max-w-[1100px] mx-auto pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 + i * 0.05 }}
              >
                <div className="p-5 rounded-lg border border-border/60 bg-card/30 backdrop-blur-sm hover:bg-card/50 hover:border-border/80 transition-colors h-full">
                  <div className="w-9 h-9 rounded-md bg-muted/40 flex items-center justify-center text-foreground mb-3">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="text-[14px] font-semibold text-foreground mb-1">{f.title}</h3>
                  <p className="text-[12.5px] text-muted-foreground leading-relaxed">{f.description}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/60 px-6 lg:px-10 py-6 max-w-[1200px] mx-auto">
        <div className="flex items-center justify-between text-[11.5px] text-muted-foreground">
          <Logo size={18} />
          <span>Phase 1 · v1.0.0 · Self-hosted on Oracle Cloud</span>
        </div>
      </footer>
    </div>
  );
}
