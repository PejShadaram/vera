import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "Sign up free — Vera",
  description:
    "Create your free Vera account. Start organizing your case in minutes — no credit card required.",
  alternates: {
    canonical: "https://veracase.app/sign-up",
  },
};

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Vera</h1>
        <p className="text-gray-500 mt-1">Know where you stand.</p>
      </div>
      <SignUp />
    </div>
  );
}
