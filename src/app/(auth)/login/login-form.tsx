"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginSchema, type LoginInput } from "@/schemas";
import { useAuthStore } from "@/stores/auth";
import { homePathForRole } from "@/lib/auth/config";

function LoginFormInner() {
  const router = useRouter();
  const params = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    const error = params.get("error");
    if (error) toast.error(error);
  }, [params]);

  const onSubmit = async (data: LoginInput) => {
    setLoading(true);
    const result = await login(data.email, data.password);
    setLoading(false);

    if (!result.ok) {
      toast.error(result.error ?? "Invalid email or password.");
      return;
    }

    const user = useAuthStore.getState().user;
    toast.success("Welcome back!");
    const next = params.get("next");
    router.push(next || homePathForRole(user?.role ?? "CUSTOMER"));
    router.refresh();
  };

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <div className="mx-auto w-full max-w-md px-4 pt-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1 rounded-lg py-2 text-sm font-medium text-navy/70 transition hover:bg-muted hover:text-navy"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Link>
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-10 pt-2">
        <div className="mb-8 text-center">
          <Logo href="/" size="lg" className="justify-center" />
          <h1 className="mt-6 text-2xl font-bold text-navy">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in with your email and password.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-card">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@email.com"
                aria-invalid={!!errors.email}
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-destructive" role="alert">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  aria-invalid={!!errors.password}
                  className="pr-10"
                  {...register("password")}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-navy"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive" role="alert">
                  {errors.password.message}
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
                "Sign in"
              )}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link
            href="/register"
            className="font-semibold text-green hover:underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginForm() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface" />}>
      <LoginFormInner />
    </Suspense>
  );
}
