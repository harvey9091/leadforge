"use client";

/**
 * Register page — create a new workspace account.
 *
 * Premium redesign:
 *  - Better form spacing
 *  - Refined password strength indicators
 *  - Better visual hierarchy
 */

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Check } from "lucide-react";
import { AuthLayout } from "@/features/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerSchema, type RegisterInput } from "@/server/utils/schemas";
import { useAuth } from "@/components/providers/auth-provider";
import { navigate } from "@/hooks/use-hash-route";
import { ApiClientError } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function RegisterPage() {
  const { signUp } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  const password = form.watch("password");
  const passwordChecks = [
    { ok: password.length >= 8, label: "8+ characters" },
    { ok: /[a-z]/.test(password), label: "Lowercase letter" },
    { ok: /[A-Z]/.test(password), label: "Uppercase letter" },
    { ok: /[0-9]/.test(password), label: "Number" },
  ];

  const onSubmit = async (values: RegisterInput) => {
    setSubmitting(true);
    try {
      await signUp(values.name, values.email, values.password);
      toast({ title: "Account created", description: "Welcome to Leadforge." });
      navigate("#/dashboard");
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : "Registration failed";
      toast({ title: "Registration failed", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Create your account" description="Start discovering qualified leads in minutes.">
      <motion.form
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-5"
      >
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-[12.5px] font-medium">
            Full name
          </Label>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            placeholder="Ada Lovelace"
            className="h-10 text-[13.5px]"
            {...form.register("name")}
          />
          {form.formState.errors.name && (
            <p className="text-[11.5px] text-destructive">{form.formState.errors.name.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-[12.5px] font-medium">
            Work email
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            className="h-10 text-[13.5px]"
            {...form.register("email")}
          />
          {form.formState.errors.email && (
            <p className="text-[11.5px] text-destructive">{form.formState.errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-[12.5px] font-medium">
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              className="h-10 text-[13.5px] pr-10"
              {...form.register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {password && (
            <div className="flex items-center gap-3 flex-wrap pt-1">
              {passwordChecks.map((c) => (
                <span
                  key={c.label}
                  className={cn(
                    "flex items-center gap-1 text-[10.5px]",
                    c.ok ? "text-success" : "text-muted-foreground"
                  )}
                >
                  <Check className="w-3 h-3" />
                  {c.label}
                </span>
              ))}
            </div>
          )}
          {form.formState.errors.password && (
            <p className="text-[11.5px] text-destructive">{form.formState.errors.password.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" className="text-[12.5px] font-medium">
            Confirm password
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            className="h-10 text-[13.5px]"
            {...form.register("confirmPassword")}
          />
          {form.formState.errors.confirmPassword && (
            <p className="text-[11.5px] text-destructive">{form.formState.errors.confirmPassword.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full h-10 gap-1.5" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
          {!submitting && <ArrowRight className="w-4 h-4" />}
        </Button>
      </motion.form>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mt-6 pt-6 border-t border-border/60 text-center"
      >
        <p className="text-[12.5px] text-muted-foreground">
          Already have an account?{" "}
          <a href="#/login" className="text-foreground font-medium hover:underline">
            Sign in
          </a>
        </p>
      </motion.div>
    </AuthLayout>
  );
}
