import { useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import LoginCheck from "@/components/LoginCheck";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import AuthCard from "./AuthCard";
import PasswordInput from "./PasswordInput";

export default function LoginPage() {
  const { user, login } = useAuth();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null); // { message, field }

  // The fields were disabled while sending, so focus is lost; put it where the fix is.
  useEffect(() => {
    if (error) document.getElementById(error.field)?.focus();
  }, [error]);

  if (user === undefined) return <LoginCheck />;
  // Once logged in to an account, go back to the page that sent us here. Guests stay to log in.
  if (user && !user.isGuest) return <Navigate to={location.state?.from ?? "/"} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await login({ email: form.get("email"), password: form.get("password") });
    } catch (err) {
      setError({ message: err.message, field: "current-password" });
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="Log in"
      subtitle={user?.isGuest
        ? "Log in to add what you did as a guest to your account."
        : "Welcome back. Log in to see your energy use."}
      footer={
        <>
          New to EnergyWise?{" "}
          <Link to="/register" state={location.state} className="text-primary underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <fieldset disabled={busy} className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              spellCheck="false"
              enterKeyHint="next"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="current-password">Password</Label>
            <PasswordInput
              id="current-password"
              name="password"
              autoComplete="current-password"
              enterKeyHint="done"
              maxLength={128}
              required
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error.message}
            </p>
          )}

          <Button type="submit" size="lg">
            {busy ? "Logging in..." : "Log in"}
          </Button>
        </fieldset>
      </form>
    </AuthCard>
  );
}
