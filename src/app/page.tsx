"use client";

/**
 * Root page — hash-router entry point.
 *
 * Because the host environment only exposes a single Next.js route (`/`),
 * the entire application is a hash-routed SPA. This component reads the
 * current hash and renders the matching view.
 *
 * Routing rules:
 *  - Auth routes (login, register, forgot-password) → render without shell
 *  - Protected routes → require auth, redirect to /login if not signed in
 *  - Shell routes → rendered inside the AppShell (sidebar + topbar)
 *  - /landing or / → public landing page (redirects to /dashboard if logged in)
 *
 * Migration path: in Phase 2+, this can be split into Next.js App Router
 * routes (src/app/dashboard/page.tsx, etc.) without touching the view
 * components themselves.
 */

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useHashRoute } from "@/hooks/use-hash-route";
import { ROUTES, getCompanyIdFromHash } from "@/lib/routes";
import { AppShell } from "@/components/layout/app-shell";
import { AuthProvider, useAuth } from "@/components/providers/auth-provider";
import { LandingPage } from "@/features/landing/landing-page";
import { LoginPage } from "@/features/auth/login-page";
import { RegisterPage } from "@/features/auth/register-page";
import { ForgotPasswordPage } from "@/features/auth/forgot-password-page";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { DiscoverPage } from "@/features/discover/discover-page";
import { EnrichPage } from "@/features/enrich/enrich-page";
import { LeadsPage } from "@/features/leads/leads-page";
import { CompaniesPage } from "@/features/companies/companies-page";
import { CompanyDetailPage } from "@/features/companies/company-detail-page";
import { PeoplePage } from "@/features/people/people-page";
import { AnalyticsPage } from "@/features/analytics/analytics-page";
import { AiInsightsPage } from "@/features/ai-insights/ai-insights-page";
import { FeedPage } from "@/features/feed/feed-page";
import { SystemPage } from "@/features/system/system-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { NotFoundPage } from "@/features/not-found/not-found-page";
import { Logo } from "@/components/brand/logo";

export default function HomePage() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}

function Router() {
  const route = useHashRoute();
  const { user, booting } = useAuth();

  // Initial boot — wait for auth to hydrate before rendering anything
  if (booting) return <BootScreen />;

  const meta = ROUTES[route.id];

  // Redirect logged-in users away from public auth pages
  if (user && (route.id === "landing" || route.id === "login" || route.id === "register" || route.id === "forgot-password")) {
    return renderRoute("dashboard", user);
  }

  // Redirect logged-out users away from protected routes
  if (!user && meta?.protected) {
    return <LoginPage />;
  }

  return renderRoute(route.id, user);
}

function renderRoute(id: string, _user: unknown): React.ReactNode {
  // Public routes — no shell
  switch (id) {
    case "landing":
      return <LandingPage />;
    case "login":
      return <LoginPage />;
    case "register":
      return <RegisterPage />;
    case "forgot-password":
      return <ForgotPasswordPage />;
    case "404":
      return <NotFoundPage />;
  }

  // Shell routes — wrapped in AppShell
  const view = renderView(id);
  return (
    <AppShell>
      <AnimatePresence mode="wait">
        <motion.div
          key={id}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
        >
          {view}
        </motion.div>
      </AnimatePresence>
    </AppShell>
  );
}

function renderView(id: string): React.ReactNode {
  switch (id) {
    case "dashboard":
      return <DashboardPage />;
    case "discover":
      return <DiscoverPage />;
    case "enrich":
      return <EnrichPage />;
    case "leads":
      return <LeadsPage />;
    case "companies":
      return <CompaniesPage />;
    case "company":
      return <CompanyDetailPage companyId={getCompanyIdFromHash(window.location.hash) ?? ""} />;
    case "compare":
      return <CompaniesPage />; // compare is launched from companies
    case "people":
      return <PeoplePage />;
    case "analytics":
      return <AnalyticsPage />;
    case "ai-insights":
      return <AiInsightsPage />;
    case "feed":
      return <FeedPage />;
    case "system":
      return <SystemPage />;
    case "settings":
    case "settings.general":
    case "settings.profile":
    case "settings.appearance":
    case "settings.api-keys":
    case "settings.integrations":
    case "settings.workers":
    case "settings.system":
      return <SettingsPage />;
    default:
      return <NotFoundPage />;
  }
}

function BootScreen() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center gap-4"
      >
        <Logo size={32} />
        <div className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <span className="w-1 h-1 rounded-full bg-foreground/40 animate-pulse" />
          Loading workspace…
        </div>
      </motion.div>
    </div>
  );
}
