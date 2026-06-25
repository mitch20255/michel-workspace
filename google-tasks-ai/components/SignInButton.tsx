"use client";

import { signIn } from "next-auth/react";

export function SignInButton() {
  return (
    <button
      onClick={() => signIn("google")}
      className="rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700"
    >
      Se connecter avec Google
    </button>
  );
}
