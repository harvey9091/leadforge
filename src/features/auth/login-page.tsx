"use client";

/**
 * Login page — email + password sign-in.
 *
 * Premium redesign:
 *  - Better form spacing
 *  - Refined input styling
 *  - Better error states
 *  - Premium button with hover effects
 */

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { AuthLayout } from "@/features/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { loginSchema, type LoginInput } from "@/server/utils/schemas";
import { useAuth } from "@/components/providers/auth-provider";
import { navigate } from "@/hooks/use-hash-route";
import { ApiClientError } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

export function LoginPage() {
  const { signIn } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "admin@leadforge.local", password: "Leadforge123" },
  });

  const onSubmit = async (values: LoginInput) => {
    setSubmitting(true);
    try {
      await signIn(values.email, values.password);
      toast({ title: "Welcome back", description: "You're now signed in." });
      navigate("#/dashboard");
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : "Sign-in failed";
      toast({ title: "Sign-in failed", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Sign in to your workspace" description="Enter your credentials to continue.">
      <motion.form
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-5"
      >
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-[12.5px] font-medium">
            Email
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
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-[12.5px] font-medium">
              Password
            </Label>
            <a
              href="#/forgot-password"
              className="text-[11.5px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Forgot password?
            </a>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
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
          {form.formState.errors.password && (
            <p className="text-[11.5px] text-destructive">{form.formState.errors.password.message}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="remember" defaultChecked />
          <Label htmlFor="remember" className="text-[12.5px] text-muted-foreground cursor-pointer">
            Keep me signed in for 30 days
          </Label>
        </div>

        <Button
          type="submit"
          className="w-full h-10 gap-1.5"
          disabled={submitting}
        >
          {submitting ? "Signing in…" : "Sign in"}
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
          Don't have an account?{" "}
          <a href="#/register" className="text-foreground font-medium hover:underline">
            Create one
          </a>
        </p>
      </motion.div>
    </AuthLayout>
  );
}
