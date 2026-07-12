"use client";

/**
 * Forgot password page — Phase 2 placeholder.
 *
 * The form is functional (validates email) but the actual email sending
 * will be wired in Phase 2 alongside the SMTP relay integration.
 */

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, ArrowLeft, MailCheck } from "lucide-react";
import { AuthLayout } from "@/features/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/server/utils/schemas";
import { useToast } from "@/hooks/use-toast";

export function ForgotPasswordPage() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = React.useState(false);
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = (values: ForgotPasswordInput) => {
    setSubmitted(true);
    toast({
      title: "Reset link sent (simulated)",
      description: `A password reset link would be sent to ${values.email}. Email sending is wired in Phase 2.`,
    });
  };

  return (
    <AuthLayout
      title="Reset your password"
      description="Enter your email and we'll send you a reset link."
    >
      {submitted ? (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-lg bg-success/10 text-success flex items-center justify-center mx-auto mb-4">
            <MailCheck className="w-5 h-5" />
          </div>
          <h3 className="text-[14px] font-semibold text-foreground mb-1">Check your inbox</h3>
          <p className="text-[12.5px] text-muted-foreground max-w-xs mx-auto leading-relaxed">
            If an account exists with that email, a reset link is on its way. The link
            expires in 30 minutes.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-5 gap-1.5"
            onClick={() => {
              setSubmitted(false);
              window.location.hash = "#/login";
            }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to sign in
          </Button>
        </div>
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
          <Button type="submit" className="w-full h-10 gap-1.5">
            Send reset link
            <ArrowRight className="w-4 h-4" />
          </Button>
          <a
            href="#/login"
            className="block text-center text-[12.5px] text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to sign in
          </a>
        </form>
      )}
    </AuthLayout>
  );
}
