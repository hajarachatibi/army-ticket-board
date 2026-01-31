"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/lib/AuthContext";
import { fetchProfile } from "@/lib/data/user_profiles";
import { useTheme } from "@/lib/ThemeContext";

export default function SettingsView() {
  const { user } = useAuth();
  const { dark, toggle } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ username: string } | null>(null);

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
    if (data) setProfile({ username: data.username });
    else setProfile({ username: user.username });
  }, [user?.id, user?.username, user?.email]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

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
