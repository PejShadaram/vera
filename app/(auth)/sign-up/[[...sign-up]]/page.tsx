import { SignUp } from "@clerk/nextjs";

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
