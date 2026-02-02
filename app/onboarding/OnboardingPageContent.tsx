"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/lib/AuthContext";
import { validateAllSocials } from "@/lib/security/socialValidation";
import { supabase } from "@/lib/supabaseClient";

type OnboardingStatus = {
  onboarding_completed: boolean;
  terms_accepted: boolean;
  user_agreement_accepted: boolean;
};

type ArmyProfileQuestionRow = { key: string; prompt: string };

function nonEmpty(s: string): boolean {
  return s.trim().length > 0;
}

export default function OnboardingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/tickets";

  const { isLoggedIn, isLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [country, setCountry] = useState("");
  const [is18, setIs18] = useState(false);
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [snapchat, setSnapchat] = useState("");

  const [biasAnswer, setBiasAnswer] = useState("");
  const [yearsArmy, setYearsArmy] = useState("");
  const [favoriteAlbum, setFavoriteAlbum] = useState("");

  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeUserAgreement, setAgreeUserAgreement] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [armyProfilePrompts, setArmyProfilePrompts] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isLoggedIn) return;
      setLoading(true);
      setError(null);
      const { data, error: e } = await supabase.rpc("my_onboarding_status");
      if (cancelled) return;
      if (e) setError(e.message);
      setStatus({
        onboarding_completed: Boolean((data as any)?.onboarding_completed),
        terms_accepted: Boolean((data as any)?.terms_accepted),
        user_agreement_accepted: Boolean((data as any)?.user_agreement_accepted),
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isLoggedIn) return;
      const { data, error: e } = await supabase.rpc("get_army_profile_questions");
      if (cancelled) return;
      if (e) return;
      const rows = (data ?? []) as ArmyProfileQuestionRow[];
      const map: Record<string, string> = {};
      for (const r of rows) map[String(r.key)] = String(r.prompt ?? "");
      setArmyProfilePrompts(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (!nonEmpty(firstName)) return false;
    if (!nonEmpty(country)) return false;
    if (!is18) return false;
    if (!nonEmpty(instagram) && !nonEmpty(facebook) && !nonEmpty(tiktok) && !nonEmpty(snapchat)) return false;
    if (validateAllSocials({ instagram, facebook, tiktok, snapchat })) return false;
    if (biasAnswer.trim().length < 100) return false;
    if (!nonEmpty(yearsArmy)) return false;
    if (!nonEmpty(favoriteAlbum)) return false;
    if (!agreeTerms) return false;
    if (!agreeUserAgreement) return false;
    return true;
  }, [agreeTerms, agreeUserAgreement, biasAnswer, country, favoriteAlbum, facebook, firstName, instagram, is18, snapchat, submitting, tiktok, yearsArmy]);

  const socialsValidationError = useMemo(() => {
    return validateAllSocials({ instagram, facebook, tiktok, snapchat });
  }, [facebook, instagram, snapchat, tiktok]);

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          country: country.trim(),
          is18Confirmed: is18,
          instagram: instagram.trim() || null,
          facebook: facebook.trim() || null,
          tiktok: tiktok.trim() || null,
          snapchat: snapchat.trim() || null,
          armyBiasAnswer: biasAnswer.trim(),
          armyYearsArmy: yearsArmy.trim(),
          armyFavoriteAlbum: favoriteAlbum.trim(),
          acceptTerms: true,
          acceptUserAgreement: true,
        }),
      });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !j?.ok) {
        setError(j?.error || `HTTP ${res.status}`);
        return;
      }
      router.replace(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit onboarding");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gradient-army-subtle px-4 py-12">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-army-purple">Loading…</p>
        </div>
      </main>
    );
  }

  if (!isLoggedIn) {
    return (
      <main className="min-h-screen bg-gradient-army-subtle px-4 py-12">
        <div className="mx-auto max-w-2xl rounded-2xl border border-army-purple/15 bg-white p-6 text-center shadow-sm dark:border-army-purple/25 dark:bg-neutral-900">
          <h1 className="font-display text-2xl font-bold text-army-purple">Finish setup</h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">Please sign in to continue.</p>
          <Link href="/login" className="btn-army mt-6 inline-flex">
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  if (!loading && status?.onboarding_completed && status?.terms_accepted && status?.user_agreement_accepted) {
    return (
      <main className="min-h-screen bg-gradient-army-subtle px-4 py-12">
        <div className="mx-auto max-w-2xl rounded-2xl border border-army-purple/15 bg-white p-6 text-center shadow-sm dark:border-army-purple/25 dark:bg-neutral-900">
          <h1 className="font-display text-2xl font-bold text-army-purple">All set</h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">Your profile setup is complete.</p>
          <Link href={next} className="btn-army mt-6 inline-flex">
            Continue
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-army-subtle px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-army-purple/15 bg-white p-6 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900">
          <h1 className="font-display text-2xl font-bold text-army-purple">Finish setup</h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            This is required to use the app. Admins do not verify tickets or handle payments.
          </p>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="mt-6 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-army-purple">First name</label>
              <input className="input-army mt-2" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>

            <div>
              <label className="block text-sm font-semibold text-army-purple">Country</label>
              <input className="input-army mt-2" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. USA" />
            </div>

            <div className="rounded-xl border border-army-purple/15 bg-white/80 p-4 text-sm text-neutral-700 dark:border-army-purple/25 dark:bg-neutral-900/60 dark:text-neutral-300">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-army-purple/30 text-army-purple focus:ring-army-purple"
                  checked={is18}
                  onChange={(e) => setIs18(e.target.checked)}
                  disabled={submitting}
                />
                <span>I confirm I am 18+.</span>
              </label>
            </div>

            <div className="rounded-xl border border-army-purple/15 bg-white/80 p-4 dark:border-army-purple/25 dark:bg-neutral-900/60">
              <p className="text-sm font-semibold text-army-purple">Connect at least one social</p>
              <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
                Important: there is <span className="font-semibold">no in-app buyer/seller chat</span>. When you match with an ARMY,
                you will contact each other through the social you put here. Please choose the correct social.
              </p>
              <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                To prevent scams and keep things stable, you can change your socials only <span className="font-semibold">once every 30 days</span>.
              </p>
              <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                Please use <span className="font-semibold">usernames only</span> (no phone numbers, emails, WhatsApp, Telegram, or links).
              </p>
              {socialsValidationError && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                  {socialsValidationError}
                </div>
              )}
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-army-purple">Instagram</label>
                  <input className="input-army mt-2" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@yourhandle" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-army-purple">Facebook</label>
                  <input className="input-army mt-2" value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="profile link or name" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-army-purple">TikTok</label>
                  <input className="input-army mt-2" value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder="@yourhandle" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-army-purple">Snapchat</label>
                  <input className="input-army mt-2" value={snapchat} onChange={(e) => setSnapchat(e.target.value)} placeholder="@yourhandle" />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-army-purple/15 bg-white/80 p-4 dark:border-army-purple/25 dark:bg-neutral-900/60">
              <p className="text-sm font-semibold text-army-purple">ARMY profile (required)</p>

              <div className="mt-3 space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-army-purple">
                    {armyProfilePrompts.bias || "Who is your bias? Why? (min 100 chars)"}
                  </label>
                  <textarea
                    className="input-army mt-2 resize-none"
                    rows={4}
                    value={biasAnswer}
                    onChange={(e) => setBiasAnswer(e.target.value)}
                    placeholder="Write at least 100 characters…"
                  />
                  <p className="mt-1 text-xs text-neutral-500">{biasAnswer.trim().length}/100</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-army-purple">
                    {armyProfilePrompts.years_army || "How many years have you been ARMY?"}
                  </label>
                  <input className="input-army mt-2" value={yearsArmy} onChange={(e) => setYearsArmy(e.target.value)} placeholder="e.g. 5" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-army-purple">
                    {armyProfilePrompts.favorite_album || "What is your favorite BTS album?"}
                  </label>
                  <input className="input-army mt-2" value={favoriteAlbum} onChange={(e) => setFavoriteAlbum(e.target.value)} placeholder="e.g. Love Yourself: Tear" />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-army-purple/15 bg-white/80 p-4 text-sm text-neutral-700 dark:border-army-purple/25 dark:bg-neutral-900/60 dark:text-neutral-300">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-army-purple/30 text-army-purple focus:ring-army-purple"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  disabled={submitting}
                />
                <span>
                  I agree to the{" "}
                  <a href="/terms" target="_blank" rel="noreferrer" className="font-semibold text-army-purple underline">
                    Terms and Conditions
                  </a>
                  .
                </span>
              </label>
              <label className="mt-3 flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-army-purple/30 text-army-purple focus:ring-army-purple"
                  checked={agreeUserAgreement}
                  onChange={(e) => setAgreeUserAgreement(e.target.checked)}
                  disabled={submitting}
                />
                <span>
                  I agree to the{" "}
                  <a
                    href="/user-agreement"
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-army-purple underline"
                  >
                    User Agreement
                  </a>
                  .
                </span>
              </label>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className="btn-army" disabled={!canSubmit || submitting} onClick={onSubmit}>
              {submitting ? "Saving…" : "Save and continue"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

