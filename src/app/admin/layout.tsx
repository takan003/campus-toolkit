"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchSession } from "@/lib/session";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    fetchSession(true).then((session) => {
      if (cancelled) return;
      if (!session || session.role !== "admin") {
        router.push("/");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return <>{children}</>;
}
