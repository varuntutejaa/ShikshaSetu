"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Zap,
  BookOpen,
  Mic,
  GraduationCap,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTeacherAuth } from "@/lib/teacher-auth";
import { Logo } from "@/components/brand/logo";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/live-class", label: "Live Class", icon: Zap },
  { href: "/lessons", label: "Lessons", icon: BookOpen },
  { href: "/viva", label: "AI Viva", icon: Mic },
  { href: "/students", label: "Students", icon: GraduationCap },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { teacher } = useTeacherAuth();

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-sidebar-border">
        <Logo size={38} className="shrink-0" />
        <div className="leading-tight">
          <p className="font-semibold text-sidebar-foreground text-[15px]">ShikshaSetu</p>
          <p className="text-[11px] text-sidebar-foreground/60">Smart Education, Jharkhand</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-5 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname?.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon
                className={cn(
                  "h-[18px] w-[18px] shrink-0",
                  active ? "text-sidebar-primary" : ""
                )}
              />
              {item.label}
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-sidebar-border">
        <div className="rounded-lg bg-sidebar-accent/60 px-3 py-3">
          <p className="text-xs font-medium text-sidebar-foreground/90">
            {teacher?.school_name ?? "Add your school in Settings"}
          </p>
          <p className="text-[11px] text-sidebar-foreground/60 mt-0.5">
            {teacher?.name ?? "Signing in…"}
          </p>
        </div>
      </div>
    </aside>
  );
}
