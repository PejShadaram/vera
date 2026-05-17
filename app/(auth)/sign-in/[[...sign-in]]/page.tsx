import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "Sign in — Vera",
  description: "Sign in to your Vera account to manage your case.",
  alternates: {
    canonical: "https://veracase.app/sign-in",
  },
};

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Vera</h1>
        <p className="text-gray-500 mt-1">Know where you stand.</p>
      </div>
      <SignIn />
    </div>
  );
}
