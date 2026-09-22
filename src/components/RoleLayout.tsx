"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchSession } from "@/lib/session";

export default function RoleLayout({
  children,
  role,
}: {
  children: React.ReactNode;
  role: "student" | "parent" | "staff";
}) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    fetchSession(true).then((session) => {
      if (cancelled) return;
      if (!session || session.role !== role) {
        router.push("/");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [router, role]);

  return <>{children}</>;
}
