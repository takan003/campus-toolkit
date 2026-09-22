"use client";

import RoleLayout from "@/components/RoleLayout";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <RoleLayout role="student">{children}</RoleLayout>;
}
