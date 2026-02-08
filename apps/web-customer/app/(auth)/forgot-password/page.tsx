"use client";

import { useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createSupabaseBrowser();
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    const redirectTo = `${window.location.origin}/auth/callback`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setLoading(false);

    if (error) return setMsg(error.message);
    setMsg("Reset email sent. Check your inbox (and spam, because email providers are haters).");
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600 }}>Forgot password</h2>

      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />

      <button disabled={loading} type="submit">
        {loading ? "Sending..." : "Send reset email"}
      </button>

      <a href="/login">Back to login</a>

      {msg && <p>{msg}</p>}
    </form>
  );
}
