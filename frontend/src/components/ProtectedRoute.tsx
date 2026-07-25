"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useStore } from "@/store";

interface ProtectedRouteProps {
  children: React.ReactElement;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated } = useStore();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return <div className="p-4">Loading...</div>;
  }

  return children;
};

export default ProtectedRoute;
