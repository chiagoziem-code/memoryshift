import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, LogOut, ShieldCheck, Trash2, UploadCloud, UserPlus } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import {
  AGE_BANDS,
  CONSENT_VERSION,
  addLearner,
  deleteLearner,
  ensureConsent,
  listLearners,
  loadActiveLearner,
  recordConsent,
  saveActiveLearner,
  setLearnerPilot,
  syncAll,
  type AgeBand,
  type Learner,
} from "@/lib/sync";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Parents — MemoryShift" },
      {
        name: "description",
        content: "Parent sign-in for the MemoryShift pilot: consent, learners and saved memory-check results.",
      },
    ],
  }),
  component: AccountPage,
});

const CONSENT_POINTS = [
  "I am the parent or guardian of the learner(s) I add.",
  "MemoryShift will store each learner's nickname, age band and memory-check answers and scores, to measure whether memory aids help them remember.",
  "MemoryShift does not ask for or store any diagnosis, surnames, photos or the study material itself.",
  "Pilot results are only reported grouped together, never by name.",
  "I can delete a learner and all of their results at any time from this page.",
];

function AccountPage() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto w-full max-w-3xl space-y-8 px-5 py-10">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold">Parents</h1>
          <p className="text-lg text-muted-foreground">
            For families in the MemoryShift pilot. Sign in, add your child, and their memory-check
            results are saved safely. Learners can still use the app without this.
          </p>
        </div>
        {user === undefined ? (
          <Loader2 className="size-6 animate-spin" />
        ) : user === null ? (
          <SignInCard />
        ) : (
          <SignedIn user={user} />
        )}
      </main>
    </div>
  );
}

function ConsentList() {
  return (
    <ul className="space-y-2 text-base">
      {CONSENT_POINTS.map((point) => (
        <li key={point} className="flex gap-2">
          <ShieldCheck className="mt-1 size-4 shrink-0 text-primary" />
          <span>{point}</span>
        </li>
      ))}
    </ul>
  );
}

function SignInCard() {
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        if (!consent) {
          toast.error("Please tick the consent box to join the pilot");
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/account`,
            data: { consent_version: CONSENT_VERSION, consented_at: new Date().toISOString() },
          },
        });
        if (error) throw error;
        if (!data.session) setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <Card className="border-2 border-primary/50">
        <CardContent className="space-y-2 pt-6 text-lg">
          <p className="text-2xl font-semibold">Check your email</p>
          <p>
            We sent a link to <span className="font-semibold">{email}</span>. Open it to confirm,
            then come back here and sign in.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2">
      <CardHeader className="gap-3">
        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === "signup" ? "default" : "outline"}
            onClick={() => setMode("signup")}
          >
            Join the pilot
          </Button>
          <Button
            type="button"
            variant={mode === "signin" ? "default" : "outline"}
            onClick={() => setMode("signin")}
          >
            Sign in
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={(event) => void submit(event)}>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-base">
              Parent's email
            </Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="text-lg"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-base">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="text-lg"
            />
            {mode === "signup" && (
              <p className="text-sm text-muted-foreground">At least 8 characters.</p>
            )}
          </div>
          {mode === "signup" && (
            <div className="space-y-3 rounded-2xl border-2 border-border bg-secondary/40 px-4 py-4">
              <p className="font-semibold">Parent consent</p>
              <ConsentList />
              <label className="flex items-start gap-3 pt-1 text-base font-semibold">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-1 size-5"
                />
                I agree to all of the above.
              </label>
            </div>
          )}
          <Button type="submit" size="lg" className="w-full text-lg" disabled={busy}>
            {busy && <Loader2 className="mr-2 size-5 animate-spin" />}
            {mode === "signup" ? "Create parent account" : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function SignedIn({ user }: { user: User }) {
  const [consented, setConsented] = useState<boolean | null>(null);
  const [learners, setLearners] = useState<Learner[]>([]);
  const [active, setActive] = useState<Learner | null>(null);
  const [nickname, setNickname] = useState("");
  const [ageBand, setAgeBand] = useState<AgeBand>("9-11");
  const [pilot, setPilot] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const list = await listLearners();
      setLearners(list);
      const current = loadActiveLearner();
      const match = list.find((l) => l.id === current?.id) ?? null;
      if (current && !match) saveActiveLearner(null);
      if (match) saveActiveLearner(match);
      setActive(match);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load learners");
    }
  }, []);

  useEffect(() => {
    void ensureConsent().then((ok) => {
      setConsented(ok);
      if (ok) void refresh();
    });
  }, [refresh]);

  function choose(learner: Learner) {
    saveActiveLearner(learner);
    setActive(learner);
    toast.success(`${learner.nickname} is learning on this device now`);
    void syncAll();
  }

  async function onAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!nickname.trim()) return;
    setBusy(true);
    try {
      const learner = await addLearner(nickname, ageBand, pilot);
      setNickname("");
      await refresh();
      choose(learner);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add learner");
    } finally {
      setBusy(false);
    }
  }

  async function onPilot(learner: Learner, value: boolean) {
    try {
      await setLearnerPilot(learner.id, value);
      const updated = { ...learner, pilot_mode: value };
      if (active?.id === learner.id) {
        saveActiveLearner(updated);
        setActive(updated);
      }
      setLearners((list) => list.map((l) => (l.id === learner.id ? updated : l)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update");
    }
  }

  async function onDelete(learner: Learner) {
    if (!window.confirm(`Delete ${learner.nickname} and all of their saved results? This can't be undone.`))
      return;
    try {
      await deleteLearner(learner.id);
      if (active?.id === learner.id) saveActiveLearner(null);
      toast.success(`${learner.nickname}'s data was deleted`);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete");
    }
  }

  async function onSync() {
    setBusy(true);
    const count = await syncAll();
    setBusy(false);
    toast.success(count === 0 ? "Nothing new to save" : `Saved ${count} memory check${count === 1 ? "" : "s"}`);
  }

  async function onSignOut() {
    saveActiveLearner(null);
    await supabase.auth.signOut();
  }

  if (consented === null) return <Loader2 className="size-6 animate-spin" />;

  if (!consented) {
    return (
      <Card className="border-2 border-primary/50">
        <CardHeader>
          <CardTitle className="text-xl">Parent consent</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ConsentList />
          <Button
            size="lg"
            onClick={() =>
              void recordConsent().then((ok) => {
                setConsented(ok);
                if (ok) void refresh();
              })
            }
          >
            I agree
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-2">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <p className="text-base">
            Signed in as <span className="font-semibold">{user.email}</span>
          </p>
          <Button variant="outline" onClick={() => void onSignOut()}>
            <LogOut className="mr-2 size-4" /> Sign out
          </Button>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Who is learning on this device?</h2>
        {learners.length === 0 && (
          <p className="text-lg text-muted-foreground">Add your child below to get started.</p>
        )}
        {learners.map((learner) => (
          <Card
            key={learner.id}
            className={`border-2 ${active?.id === learner.id ? "border-primary" : ""}`}
          >
            <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
              <div>
                <p className="flex items-center gap-2 text-xl font-semibold">
                  {active?.id === learner.id && <CheckCircle2 className="size-5 text-primary" />}
                  {learner.nickname}
                </p>
                <p className="text-sm text-muted-foreground">Age {learner.age_band}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  Pilot study mode
                  <Switch
                    checked={learner.pilot_mode}
                    onCheckedChange={(v) => void onPilot(learner, v)}
                    aria-label={`Pilot study mode for ${learner.nickname}`}
                  />
                </label>
                {active?.id !== learner.id && (
                  <Button onClick={() => choose(learner)}>This is me</Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${learner.nickname}`}
                  onClick={() => void onDelete(learner)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <UserPlus className="size-5 text-primary" /> Add a learner
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(event) => void onAdd(event)}>
            <div className="space-y-2">
              <Label htmlFor="nickname" className="text-base">
                Nickname (first name or anything they like)
              </Label>
              <Input
                id="nickname"
                required
                maxLength={40}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="text-lg"
              />
            </div>
            <div className="space-y-2">
              <p className="text-base font-medium">Age</p>
              <div className="flex flex-wrap gap-2">
                {AGE_BANDS.map((band) => (
                  <Button
                    key={band}
                    type="button"
                    variant={ageBand === band ? "default" : "outline"}
                    onClick={() => setAgeBand(band)}
                  >
                    {band}
                  </Button>
                ))}
              </div>
            </div>
            <label className="flex items-center justify-between gap-4 rounded-2xl border-2 border-border px-4 py-3 text-base">
              <span>
                <span className="font-semibold">Pilot study mode</span>
                <span className="block text-sm text-muted-foreground">
                  Half of new topics are studied as plain notes, for a fair comparison.
                </span>
              </span>
              <Switch checked={pilot} onCheckedChange={setPilot} aria-label="Pilot study mode" />
            </label>
            <Button type="submit" size="lg" disabled={busy}>
              Add learner
            </Button>
          </form>
        </CardContent>
      </Card>

      {active && (
        <Card className="border-2">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
            <p className="text-base text-muted-foreground">
              Results save automatically. Used the app before signing in? Save those too.
            </p>
            <Button variant="outline" onClick={() => void onSync()} disabled={busy}>
              <UploadCloud className="mr-2 size-4" /> Save this device's results
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
