"use client";

import { SettingsSection, SettingsRow } from "../settings-section";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

export function GeneralSection() {
  const { toast } = useToast();

  const handleSave = () => {
    toast({ title: "Settings saved", description: "Your workspace settings have been updated." });
  };

  return (
    <div className="space-y-4">
      <SettingsSection
        title="Workspace"
        description="Basic information about your Leadforge workspace."
        footer={<Button size="sm" onClick={handleSave}>Save changes</Button>}
      >
        <SettingsRow label="Workspace name" description="Displayed in the sidebar and across the app.">
          <Input defaultValue="Leadforge" className="w-64 h-9 text-[13px]" />
        </SettingsRow>
        <SettingsRow label="Workspace URL" description="Used for external links, exports, and API references.">
          <Input defaultValue="leadforge.local" className="w-64 h-9 text-[13px] font-mono" />
        </SettingsRow>
        <SettingsRow label="Description" description="Internal note, shown only to your team.">
          <Textarea defaultValue="Self-hosted lead intelligence platform." className="w-80 text-[13px]" rows={2} />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Discovery Defaults" description="Default ICP filters applied to new discovery jobs.">
        <SettingsRow label="Default industries" description="Comma-separated list of industries to target.">
          <Input defaultValue="Developer Tools, AI Infrastructure, Productivity" className="w-80 h-9 text-[13px]" />
        </SettingsRow>
        <SettingsRow label="Minimum company score" description="Companies below this score are auto-disqualified.">
          <Input type="number" defaultValue={60} className="w-24 h-9 text-[13px]" />
        </SettingsRow>
        <SettingsRow label="Auto-enrich on discovery" description="Run enrichment pipeline automatically for new companies.">
          <Switch defaultChecked />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Data Retention" description="How long to keep data before automatic cleanup.">
        <SettingsRow label="Disqualified leads" description="Auto-delete after this many days.">
          <Input type="number" defaultValue={90} className="w-24 h-9 text-[13px]" />
        </SettingsRow>
        <SettingsRow label="Audit logs" description="Compliance requirement: minimum retention period.">
          <Input type="number" defaultValue={365} className="w-24 h-9 text-[13px]" />
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}
