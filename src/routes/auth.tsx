import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Leaf } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { resolveLanding } from "@/lib/portal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — EnvironIQ for Samak Landscape" },
      {
        name: "description",
        content:
          "Secure sign-in to EnvironIQ, the AI-first landscape ERP and GrowIQ intelligence platform for Samak Landscape.",
      },
      { property: "og:title", content: "Sign in — EnvironIQ" },
      {
        property: "og:description",
        content: "Secure sign-in to the EnvironIQ landscape ERP and GrowIQ intelligence platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) void navigate({ to: await resolveLanding() });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: { full_name: fullName },
          },
        });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
      await navigate({ to: await resolveLanding() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between surface-canopy p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2">
          <Leaf className="h-6 w-6" />
          <span className="font-display text-xl font-semibold">EnvironIQ</span>
        </div>
        <div className="max-w-md space-y-4">
          <h1 className="font-display text-4xl leading-tight font-semibold">
            One intelligent operating system for Samak Landscape.
          </h1>
          <p className="text-primary-foreground/80">
            Projects, horticulture, procurement, finance and field operations in a single system of
            record — with GrowIQ as the intelligence layer reading only what you are permitted to
            see.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/60">
          Design · Build · Maintain — landscape architecture at enterprise scale.
        </p>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div>
            <h2 className="font-display text-2xl font-semibold">
              {mode === "signin" ? "Sign in" : "Create your account"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Staff, clients and supply partners sign in here — you land in the right workspace
              automatically.
            </p>
          </div>

          {mode === "signup" ? (
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>

          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>

          <button
            type="button"
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin"
              ? "No account yet? Create one"
              : "Already registered? Sign in instead"}
          </button>
        </form>
      </div>
    </div>
  );
}
