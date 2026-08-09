"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AuthDivider,
  GoogleSignInButton,
} from "@/components/auth/GoogleSignInButton";
import { registerSchema, type RegisterInput } from "@/schemas";
import { useAuthStore } from "@/stores/auth";
import { homePathForRole } from "@/lib/auth/config";

function RegisterForm() {
  const router = useRouter();
  const registerAccount = useAuthStore((s) => s.register);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: RegisterInput) => {
    setLoading(true);
    const result = await registerAccount({
      email: data.email,
      password: data.password,
      fullName: data.fullName,
      phone: data.phone || undefined,
    });
    setLoading(false);

    if (!result.ok) {
      toast.error(result.error ?? "Could not create account.");
      return;
    }

    if (result.bootstrappedAdmin) {
      toast.success(
        "Account created. You are the first user — Super Admin access granted."
      );
    } else {
      toast.success("Account created! Welcome to Island Coolers.");
    }

    const user = useAuthStore.getState().user;
    router.push(homePathForRole(user?.role ?? "CUSTOMER"));
    router.refresh();
  };

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <div className="mb-8 text-center">
          <Logo href="/" size="lg" className="justify-center" />
          <h1 className="mt-6 text-2xl font-bold text-navy">Create account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign up with Google or email to start ordering.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-card">
          <Suspense fallback={null}>
            <GoogleSignInButton label="Sign up with Google" />
          </Suspense>
          <AuthDivider text="or sign up with email" />

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                autoComplete="name"
                placeholder="Maria Santos"
                {...register("fullName")}
              />
              {errors.fullName && (
                <p className="text-xs text-destructive" role="alert">
                  {errors.fullName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@email.com"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-destructive" role="alert">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">
                Phone <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+63 9XX XXX XXXX"
                {...register("phone")}
              />
              {errors.phone && (
                <p className="text-xs text-destructive" role="alert">
                  {errors.phone.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-destructive" role="alert">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                {...register("confirmPassword")}
              />
              {errors.confirmPassword && (
                <p className="text-xs text-destructive" role="alert">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full bg-green hover:bg-green/90"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Create account"
              )}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-green hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface" />}>
      <RegisterForm />
    </Suspense>
  );
}
