"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    const session = localStorage.getItem("user_session");
    if (!session) {
      router.push("/");
      return;
    }

    try {
      const parsed = JSON.parse(session);
      if (parsed.role !== "admin") {
        router.push("/");
      }
    } catch {
      router.push("/");
    }
  }, [router]);

  return <>{children}</>;
}
