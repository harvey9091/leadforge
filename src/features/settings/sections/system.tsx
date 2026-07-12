"use client";

import { SettingsSection, SettingsRow } from "../settings-section";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function SystemSection() {
  return (
    <div className="space-y-4">
      <SettingsSection
        title="Logging"
        description="Configure structured logging output. All logs are JSON-formatted to stdout."
      >
        <SettingsRow label="Log level" description="Minimum severity to emit.">
          <div className="flex items-center gap-1.5 text-[12px]">
            <Button variant="outline" size="sm" className="h-7">debug</Button>
            <Button variant="secondary" size="sm" className="h-7">info</Button>
            <Button variant="outline" size="sm" className="h-7">warn</Button>
            <Button variant="outline" size="sm" className="h-7">error</Button>
          </div>
        </SettingsRow>
        <SettingsRow label="Request ID logging" description="Include X-Request-Id in every log line for tracing.">
          <Switch defaultChecked />
        </SettingsRow>
        <SettingsRow label="Query logging" description="Log all database queries (development only).">
          <Switch />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Rate Limiting"
        description="Protect the API from abuse. Per-IP and per-user limits."
      >
        <SettingsRow label="Auth endpoints" description="Max requests per 15 minutes per IP.">
          <Input type="number" defaultValue={10} className="w-20 h-9 text-[13px]" />
        </SettingsRow>
        <SettingsRow label="API endpoints" description="Max requests per minute per user.">
          <Input type="number" defaultValue={120} className="w-20 h-9 text-[13px]" />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Security"
        description="Hardening options for production deployments."
      >
        <SettingsRow label="HTTPS only" description="Redirect HTTP to HTTPS and set HSTS headers.">
          <Switch defaultChecked />
        </SettingsRow>
        <SettingsRow label="Strict CSP" description="Enforce a strict Content-Security-Policy.">
          <Switch defaultChecked />
        </SettingsRow>
        <SettingsRow label="Audit log retention (days)" description="Compliance: minimum days to keep audit logs.">
          <Input type="number" defaultValue={365} className="w-20 h-9 text-[13px]" />
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}
