"use client";

import RoleLayout from "@/components/RoleLayout";

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return <RoleLayout role="parent">{children}</RoleLayout>;
}
