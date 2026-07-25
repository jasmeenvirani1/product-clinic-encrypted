"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useStore } from "@/store";

interface PublicRouteProps {
  children: React.ReactElement;
}

const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
  const { isAuthenticated } = useStore();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/app");
    }
  }, [isAuthenticated, router]);

  if (isAuthenticated) {
    return <div className="p-4">Loading...</div>;
  }

  return children;
};

export default PublicRoute;
