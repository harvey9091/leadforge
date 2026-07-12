"use client";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      <a href="#/" className="mb-8">
        <Logo />
      </a>
      <div className="text-[80px] font-semibold tracking-tight text-foreground/20 tabular-nums">
        404
      </div>
      <h1 className="text-[20px] font-semibold text-foreground mt-2">Page not found</h1>
      <p className="mt-1.5 text-[13px] text-muted-foreground max-w-sm leading-relaxed">
        The page you're looking for doesn't exist or may have been moved.
      </p>
      <Button className="mt-6 gap-1.5" asChild>
        <a href="#/dashboard">
          Back to dashboard
        </a>
      </Button>
    </div>
  );
}
