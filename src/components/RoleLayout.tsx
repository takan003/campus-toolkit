"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/session";

export default function RoleLayout({
  children,
  role,
}: {
  children: React.ReactNode;
  role: "student" | "parent" | "staff";
}) {
  const router = useRouter();

  useEffect(() => {
    const session = getSession();
    if (!session || session.role !== role) {
      router.push("/");
    }
  }, [router, role]);

  return <>{children}</>;
}
