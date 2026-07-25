"use client";

import Button from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold text-gray-300">Error</h1>
      <p className="mt-4 text-lg text-gray-600">{error.message || "Something went wrong"}</p>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
