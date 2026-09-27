import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LoginPageProps = {
  onSignIn(email: string, password: string): Promise<void>;
  error?: string;
};

export function LoginPage({ onSignIn, error }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const message = error ?? localError;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setLocalError("Email and password are required.");
      return;
    }
    setLocalError(undefined);
    setSubmitting(true);
    try {
      await onSignIn(email.trim(), password);
    } catch {
      setLocalError("Sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <section className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-6 border-b pb-4">
          <h1 className="text-xl font-semibold tracking-tight">TDA Car Rental</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to continue.</p>
        </div>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="login-email">Email</Label>
            <Input id="login-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-password">Password</Label>
            <Input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          {message ? <p className="text-sm text-destructive" role="alert">{message}</p> : null}
          <Button className="w-full" type="submit" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </section>
    </main>
  );
}
