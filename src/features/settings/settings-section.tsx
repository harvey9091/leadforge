"use client";

/**
 * Settings section wrapper — provides the consistent card layout used by
 * every settings sub-page. Includes title, description, and a content slot.
 */

import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
}

export function SettingsSection({ title, description, children, className, footer }: SettingsSectionProps) {
  return (
    <Card className={cn("border-border/60 bg-card/40 overflow-hidden", className)}>
      <div className="p-5 border-b border-border/60">
        <h2 className="text-[14px] font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="text-[12.5px] text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
      <div className="p-5">{children}</div>
      {footer && <div className="px-5 py-3 border-t border-border/60 bg-muted/20">{footer}</div>}
    </Card>
  );
}

export function SettingsRow({
  label,
  description,
  children,
}: {
  label: React.ReactNode;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-3 first:pt-0 last:pb-0">
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-foreground">{label}</div>
        {description && (
          <div className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">{description}</div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
