"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/lib/AuthContext";
import { fetchProfile } from "@/lib/data/user_profiles";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/lib/ThemeContext";

export default function SettingsView() {
  const { user } = useAuth();
  const { dark, toggle } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ username: string } | null>(null);

  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [snapchat, setSnapchat] = useState("");
  const [socialsSaving, setSocialsSaving] = useState(false);
  const [socialsError, setSocialsError] = useState<string | null>(null);
  const [socialsSaved, setSocialsSaved] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!user?.id) return;
    setProfileLoading(true);
    setProfileError(null);
    const { data, error } = await fetchProfile(user.id);
    setProfileLoading(false);
    if (error) {
      setProfileError(error);
      setProfile({ username: user.username });
      return;
    }
    if (data) {
      setProfile({ username: data.username });
      setInstagram(String(data.instagram ?? ""));
      setFacebook(String(data.facebook ?? ""));
      setTiktok(String(data.tiktok ?? ""));
      setSnapchat(String(data.snapchat ?? ""));
    } else {
      setProfile({ username: user.username });
    }
  }, [user?.id, user?.username, user?.email]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const saveSocials = useCallback(async () => {
    if (!user?.id) return;
    setSocialsSaving(true);
    setSocialsError(null);
    setSocialsSaved(null);
    const payload = {
      instagram: instagram.trim() ? instagram.trim() : null,
      facebook: facebook.trim() ? facebook.trim() : null,
      tiktok: tiktok.trim() ? tiktok.trim() : null,
      snapchat: snapchat.trim() ? snapchat.trim() : null,
    };
    const { error } = await supabase.from("user_profiles").update(payload).eq("id", user.id);
    setSocialsSaving(false);
    if (error) {
      setSocialsError(error.message);
      return;
    }
    setSocialsSaved("Saved.");
  }, [facebook, instagram, snapchat, supabase, tiktok, user?.id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
  };

  const handlePosterClick = () => fileInputRef.current?.click();

  const clearPreview = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-bold text-army-purple">Settings</h1>

      <section className="rounded-xl border border-army-purple/15 bg-white p-6 dark:border-army-purple/25 dark:bg-neutral-900">
        <h2 className="font-display text-lg font-bold text-army-purple">Account</h2>
        {profileError && (
          <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">{profileError}</p>
        )}
        {profileLoading ? (
          <p className="mt-4 text-neutral-500 dark:text-neutral-400">Loading profile…</p>
        ) : profile ? (
          <div className="mt-4 space-y-1">
            <p className="text-sm font-semibold text-army-purple">Username</p>
            <p className="text-neutral-700 dark:text-neutral-300">{profile.username}</p>
            <p className="mt-2 text-sm font-semibold text-army-purple">Email</p>
            <p className="text-neutral-700 dark:text-neutral-300">{user?.email ?? ""}</p>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-army-purple/15 bg-white p-6 dark:border-army-purple/25 dark:bg-neutral-900">
        <h2 className="font-display text-lg font-bold text-army-purple">Socials</h2>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          You can update your social media usernames/links here. Your ARMY profile answers from onboarding can’t be changed.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold text-army-purple">Instagram</label>
            <input className="input-army mt-2" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@username or link" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-army-purple">Facebook</label>
            <input className="input-army mt-2" value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="username or link" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-army-purple">TikTok</label>
            <input className="input-army mt-2" value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder="@username or link" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-army-purple">Snapchat</label>
            <input className="input-army mt-2" value={snapchat} onChange={(e) => setSnapchat(e.target.value)} placeholder="@username" />
          </div>
        </div>

        {socialsError && (
          <p className="mt-4 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {socialsError}
          </p>
        )}
        {socialsSaved && !socialsError && (
          <p className="mt-4 rounded-lg border border-army-purple/15 bg-army-purple/5 px-3 py-2 text-sm text-army-purple dark:border-army-purple/25 dark:bg-army-purple/10">
            {socialsSaved}
          </p>
        )}

        <div className="mt-4 flex justify-end">
          <button type="button" className="btn-army" onClick={saveSocials} disabled={socialsSaving || !user?.id}>
            {socialsSaving ? "Saving…" : "Save socials"}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-army-purple/15 bg-white p-6 dark:border-army-purple/25 dark:bg-neutral-900">
        <h2 className="font-display text-lg font-bold text-army-purple">Appearance</h2>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Dark / Light mode
          </span>
          <button
            type="button"
            onClick={toggle}
            className={`relative h-8 w-14 cursor-pointer rounded-full transition-colors ${
              dark ? "bg-army-purple" : "bg-army-purple/30"
            }`}
            aria-pressed={dark}
            aria-label="Toggle dark mode"
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                dark ? "left-7" : "left-1"
              }`}
            />
          </button>
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            {dark ? "Dark" : "Light"}
          </span>
        </div>
      </section>

      <section className="rounded-xl border border-army-purple/15 bg-white p-6 dark:border-army-purple/25 dark:bg-neutral-900">
        <h2 className="font-display text-lg font-bold text-army-purple">Header poster</h2>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          Upload a BTS poster for the header (UI only, no backend).
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          aria-hidden
        />
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
          <button
            type="button"
            onClick={handlePosterClick}
            className="flex h-28 w-44 shrink-0 flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-army-purple/30 bg-army-purple/5 text-sm font-medium text-army-purple/70 transition-colors hover:border-army-purple/50 hover:bg-army-purple/10 dark:border-army-purple/40 dark:bg-army-purple/10 dark:text-army-300"
          >
            {preview ? (
              <img src={preview} alt="Poster preview" className="h-full w-full object-cover" />
            ) : (
              <>Drop image or click</>
            )}
          </button>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handlePosterClick} className="btn-army-outline">
              Choose file
            </button>
            {preview && (
              <button type="button" onClick={clearPreview} className="btn-army-ghost">
                Clear
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
