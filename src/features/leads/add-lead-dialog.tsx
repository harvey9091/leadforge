"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const SOURCE_OPTIONS = [
  { value: "Hacker News", label: "Hacker News" },
  { value: "Product Hunt", label: "Product Hunt" },
  { value: "Y Combinator", label: "Y Combinator" },
  { value: "BetaList", label: "BetaList" },
  { value: "DevHunt", label: "DevHunt" },
  { value: "Uneed", label: "Uneed" },
  { value: "Manual", label: "Manual" },
];

const EMPTY_FORM = {
  name: "",
  website: "",
  industry: "",
  country: "",
  description: "",
  source: "Manual",
  tags: "",
};

export function AddLeadDialog() {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validateForm = (): boolean => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) {
      next.name = "Company name is required";
    }
    if (form.website && form.website.trim()) {
      try {
        new URL(form.website.trim());
      } catch {
        next.website = "Please enter a valid URL (e.g. https://example.com)";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const result = await apiClient.post<{ id: string }>("/companies", {
        name: form.name.trim(),
        website: form.website.trim() || undefined,
        industry: form.industry.trim() || undefined,
        country: form.country.trim() || undefined,
        description: form.description.trim() || undefined,
        source: form.source,
        tags: form.tags.trim() || undefined,
      });

      toast({
        title: "Lead added",
        description: `${form.name.trim()} has been added to your pipeline.`,
      });

      setForm(EMPTY_FORM);
      setErrors({});
      setOpen(false);

      await queryClient.invalidateQueries({ queryKey: ["companies"] });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to add lead. Please try again.";
      toast({
        variant: "destructive",
        title: "Could not add lead",
        description: message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Add lead
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add lead</DialogTitle>
          <DialogDescription>
            Enter the company details below. Fields marked * are required.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="company">
              Company <span className="text-destructive">*</span>
            </Label>
            <Input
              id="company"
              placeholder="Acme Inc."
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              placeholder="https://example.com"
              value={form.website}
              onChange={(e) => update("website", e.target.value)}
              className={errors.website ? "border-destructive" : ""}
            />
            {errors.website && (
              <p className="text-xs text-destructive">{errors.website}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                placeholder="SaaS"
                value={form.industry}
                onChange={(e) => update("industry", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                placeholder="United States"
                value={form.country}
                onChange={(e) => update("country", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Brief description of the company..."
              rows={3}
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="source">Source</Label>
              <Select
                value={form.source}
                onValueChange={(val) => update("source", val)}
              >
                <SelectTrigger id="source">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                placeholder="b2b, startup, ai"
                value={form.tags}
                onChange={(e) => update("tags", e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
