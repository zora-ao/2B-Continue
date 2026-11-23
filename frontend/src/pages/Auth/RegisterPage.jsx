import { useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import AuthCard from "./AuthCard";
import PasswordInput from "./PasswordInput";

export default function RegisterPage() {
  const { user, register } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const justRegistered = useRef(false);

  // Once logged in, leave this page. New accounts have no household yet,
  // so they go to Appliances, which walks them through setting one up.
  if (user) return <Navigate to={justRegistered.current ? "/appliances" : "/"} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    justRegistered.current = true;
    try {
      await register({ name: form.get("name"), email: form.get("email"), password: form.get("password") });
    } catch (err) {
      justRegistered.current = false;
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="Create account"
      subtitle="Track your appliances and stay within your energy budget."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-primary underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <fieldset disabled={busy} className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" autoComplete="name" enterKeyHint="next" maxLength={120} required />
          </div>
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
            <Label htmlFor="new-password">Password</Label>
            <PasswordInput
              id="new-password"
              name="password"
              autoComplete="new-password"
              enterKeyHint="done"
              minLength={8}
              maxLength={128}
              aria-describedby="new-password-hint"
              required
            />
            <p id="new-password-hint" className="text-xs text-muted-foreground">
              At least 8 characters.
            </p>
          </div>

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <Button type="submit" size="lg">
            {busy ? "Creating account..." : "Create account"}
          </Button>
        </fieldset>
      </form>
    </AuthCard>
  );
}
