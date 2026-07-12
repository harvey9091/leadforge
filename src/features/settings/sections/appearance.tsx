"use client";

import { SettingsSection, SettingsRow } from "../settings-section";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "next-themes";
import { useToast } from "@/hooks/use-toast";

export function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  return (
    <div className="space-y-4">
      <SettingsSection title="Theme" description="Choose the color scheme for the application.">
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <button
            onClick={() => setTheme("dark")}
            className={`relative rounded-lg border-2 p-4 text-left transition-all ${theme === "dark" ? "border-foreground" : "border-border hover:border-border/80"}`}
          >
            <div className="h-16 rounded-md bg-zinc-950 mb-2 border border-zinc-800 flex items-center justify-center">
              <div className="w-8 h-2 rounded-full bg-zinc-100" />
            </div>
            <div className="text-[13px] font-medium text-foreground">Dark</div>
            <div className="text-[11px] text-muted-foreground">Default — recommended</div>
          </button>
          <button
            onClick={() => setTheme("light")}
            className={`relative rounded-lg border-2 p-4 text-left transition-all ${theme === "light" ? "border-foreground" : "border-border hover:border-border/80"}`}
          >
            <div className="h-16 rounded-md bg-white mb-2 border border-zinc-200 flex items-center justify-center">
              <div className="w-8 h-2 rounded-full bg-zinc-900" />
            </div>
            <div className="text-[13px] font-medium text-foreground">Light</div>
            <div className="text-[11px] text-muted-foreground">For bright environments</div>
          </button>
        </div>
      </SettingsSection>

      <SettingsSection title="Density" description="Adjust the spacing and size of UI elements.">
        <SettingsRow label="Compact mode" description="Reduce padding and font size to fit more on screen.">
          <Switch />
        </SettingsRow>
        <SettingsRow label="Reduce motion" description="Minimize animations and transitions.">
          <Switch />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Typography"
        description="Default font family used throughout the application."
        footer={<Button size="sm" onClick={() => toast({ title: "Saved", description: "Your appearance preferences have been saved." })}>Save preferences</Button>}
      >
        <SettingsRow label="Interface font" description="Currently using Inter, carefully selected for legibility.">
          <div className="text-[12.5px] font-medium text-foreground px-2.5 py-1.5 rounded-md bg-muted">
            Inter
          </div>
        </SettingsRow>
        <SettingsRow label="Monospace font" description="Used for code, API keys, and tabular numbers.">
          <div className="text-[12.5px] font-mono text-foreground px-2.5 py-1.5 rounded-md bg-muted">
            JetBrains Mono
          </div>
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}
