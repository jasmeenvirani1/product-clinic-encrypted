"use client";

import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { sidebarOpen } = useStore();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className={cn("flex flex-1 flex-col transition-all duration-300", sidebarOpen ? "lg:ml-0" : "lg:ml-0")}>
        <Header />
        <main className="flex-1 p-4 lg:p-6">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
