import { useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import LoginCheck from "@/components/LoginCheck";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import AuthCard from "./AuthCard";
import PasswordInput from "./PasswordInput";

export default function RegisterPage() {
  const { user, register } = useAuth();
  const [busy, setBusy] = useState(false);
  const location = useLocation();
  const [error, setError] = useState(null); // { message, field }

  // The fields were disabled while sending, so focus is lost; put it where the fix is.
  useEffect(() => {
    if (error) document.getElementById(error.field)?.focus();
  }, [error]);

  if (user === undefined) return <LoginCheck />;

  // Once this is a real account, go back to the page that sent us here. Guests stay to sign up.
  if (user && !user.isGuest) return <Navigate to={location.state?.from ?? "/"} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await register({ name: form.get("name"), email: form.get("email"), password: form.get("password") });
    } catch (err) {
      // 409 means the email is taken; anything else is most likely about the password.
      setError({ message: err.message, field: err.status === 409 ? "email" : "new-password" });
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="Create account"
      subtitle={user?.isGuest
        ? "Create an account to keep everything you added as a guest."
        : "Track your appliances and stay within your energy budget."}
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" state={location.state} className="text-primary underline">
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
              {error.message}
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
