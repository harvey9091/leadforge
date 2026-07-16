"use client";

/**
 * 404 page — premium redesign with refined styling.
 */

import * as React from "react";
import { motion } from "framer-motion";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center"
      >
        <a href="#/" className="mb-8">
          <Logo />
        </a>
        <div className="text-[80px] font-semibold tracking-tight text-foreground/10 tabular-nums leading-none">
          404
        </div>
        <h1 className="text-[20px] font-semibold text-foreground mt-4">Page not found</h1>
        <p className="mt-2 text-[13.5px] text-muted-foreground max-w-sm leading-relaxed">
          The page you're looking for doesn't exist or may have been moved.
        </p>
        <Button className="mt-6 gap-1.5" asChild>
          <a href="#/dashboard">
            <Home className="w-4 h-4" />
            Back to dashboard
          </a>
        </Button>
      </motion.div>
    </div>
  );
}
