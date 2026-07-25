import type { ReactNode } from "react";
import { APP_NAME } from "@/constants/brand";
import { LogoMark } from "@/components/LogoMark";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-3.5">
        <div className="mx-auto flex max-w-4xl items-center gap-2.5">
          <LogoMark size="sm" className="shadow-sm" />
          <span className="text-base font-semibold text-slate-800">{APP_NAME}</span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-10">
        {children}
      </main>
    </div>
  );
}
