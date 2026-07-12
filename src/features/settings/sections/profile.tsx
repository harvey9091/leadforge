"use client";

import { SettingsSection, SettingsRow } from "../settings-section";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/components/providers/auth-provider";
import { initials } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export function ProfileSection() {
  const { user } = useAuth();
  const { toast } = useToast();

  return (
    <div className="space-y-4">
      <SettingsSection
        title="Profile"
        description="Your personal account information."
        footer={<Button size="sm">Save changes</Button>}
      >
        <div className="flex items-center gap-4 pb-4 mb-4 border-b border-border/60">
          <Avatar className="w-14 h-14">
            <AvatarFallback className="bg-muted text-[15px] font-semibold">
              {user ? initials(user.name ?? user.email) : "??"}
            </AvatarFallback>
          </Avatar>
          <div>
            <Button variant="outline" size="sm">Upload photo</Button>
            <p className="text-[11.5px] text-muted-foreground mt-1.5">PNG or JPG, up to 2MB.</p>
          </div>
        </div>
        <SettingsRow label="Full name">
          <Input defaultValue={user?.name ?? ""} className="w-64 h-9 text-[13px]" />
        </SettingsRow>
        <SettingsRow label="Email address">
          <Input defaultValue={user?.email ?? ""} className="w-64 h-9 text-[13px]" disabled />
        </SettingsRow>
        <SettingsRow label="Role">
          <div className="text-[12.5px] font-medium text-foreground px-2.5 py-1.5 rounded-md bg-muted">
            {user?.role === "ADMIN" ? "Administrator" : "User"}
          </div>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Password" description="Update your password.">
        <SettingsRow label="Current password">
          <Input type="password" placeholder="••••••••" className="w-64 h-9 text-[13px]" />
        </SettingsRow>
        <SettingsRow label="New password">
          <Input type="password" placeholder="••••••••" className="w-64 h-9 text-[13px]" />
        </SettingsRow>
        <SettingsRow label="Confirm new password">
          <Input type="password" placeholder="••••••••" className="w-64 h-9 text-[13px]" />
        </SettingsRow>
        <div className="pt-3 mt-3 border-t border-border/60">
          <Button size="sm" variant="outline" onClick={() => toast({ title: "Password updated", description: "Your password has been changed successfully." })}>
            Update password
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection title="Danger Zone" description="Irreversible account actions.">
        <SettingsRow label="Sign out everywhere" description="Revoke all active sessions across all devices.">
          <Button variant="outline" size="sm">Sign out everywhere</Button>
        </SettingsRow>
        <SettingsRow label="Delete account" description="Permanently delete your account and all associated data.">
          <Button variant="destructive" size="sm">Delete account</Button>
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}
