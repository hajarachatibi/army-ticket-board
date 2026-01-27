"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/lib/AuthContext";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function AuthModal({ open, onClose }: Props) {
  const { login, register, error, clearError, authModalMode } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isRegister = authModalMode === "register";

  useEffect(() => {
    if (open) {
      setEmail("");
      setPassword("");
      setUsername("");
      clearError();
    }
  }, [open, authModalMode, clearError]);

  const handleClose = () => {
    onClose();
    setSubmitting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isRegister) {
        await register(email, password, username);
      } else {
        await login(email, password);
      }
      handleClose();
    } catch {
      // error set in context
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/50 p-4 opacity-100"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onClick={handleClose}
    >
      <div
        className="modal-panel w-full max-w-md cursor-default rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="auth-modal-title" className="font-display text-xl font-bold text-army-purple">
          {isRegister ? "Register" : "Login"}
        </h2>
        {error && (
          <div className="mt-2 max-h-40 overflow-y-auto rounded-lg bg-red-100 px-3 py-2 dark:bg-red-900/30">
            <p className="whitespace-pre-wrap break-words text-sm text-red-700 dark:text-red-300" role="alert">
              {error}
            </p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {isRegister && (
            <div>
              <label htmlFor="auth-username" className="block text-sm font-semibold text-army-purple">
                Username
              </label>
              <input
                id="auth-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="input-army mt-1"
                required={isRegister}
              />
            </div>
          )}
          <div>
            <label htmlFor="auth-email" className="block text-sm font-semibold text-army-purple">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input-army mt-1"
              required
            />
          </div>
          <div>
            <label htmlFor="auth-password" className="block text-sm font-semibold text-army-purple">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input-army mt-1"
              required
              minLength={6}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <AuthModeSwitch />
            <div className="flex gap-2">
              <button type="button" onClick={handleClose} className="btn-army-outline">
                Cancel
              </button>
              <button type="submit" className="btn-army" disabled={submitting}>
                {submitting ? "…" : isRegister ? "Register" : "Login"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function AuthModeSwitch() {
  const { openAuthModal, authModalMode } = useAuth();
  const isRegister = authModalMode === "register";
  return (
    <button
      type="button"
      onClick={() => openAuthModal(isRegister ? "login" : "register")}
      className="btn-army-ghost text-sm"
    >
      {isRegister ? "Already have an account? Login" : "Create account"}
    </button>
  );
}
