"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Zap,
  BookOpen,
  Mic,
  GraduationCap,
  Settings,
  Bell,
  ChevronDown,
  LogOut,
  User,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { logoutTeacher, LANGUAGE_CODE_TO_NAME } from "@/lib/api";
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

const NOTIFICATIONS = [
  {
    id: "n1",
    title: "Weekly assessment report ready",
    detail: "Class 2 performance summary for this week is available.",
    time: "10 min ago",
  },
  {
    id: "n2",
    title: "3 students flagged as at-risk",
    detail: "AI detected a learning gap in Addition above 10.",
    time: "1 hr ago",
  },
  {
    id: "n3",
    title: "Lesson translated successfully",
    detail: "Addition 1–20 mother-tongue version is ready in Santhali.",
    time: "Yesterday",
  },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { teacher, token, clearSession } = useTeacherAuth();
  const [interfaceLanguage, setInterfaceLanguage] = useState("Hindi");

  const teacherName = teacher?.name ?? "Teacher";
  const schoolName = teacher?.school_name ?? "No school set yet";
  const teacherLang = teacher ? LANGUAGE_CODE_TO_NAME[teacher.default_teacher_language] ?? teacher.default_teacher_language : null;
  const studentLang = teacher ? LANGUAGE_CODE_TO_NAME[teacher.default_student_language] ?? teacher.default_student_language : null;

  async function handleLogout() {
    clearSession();
    if (token) {
      try {
        await logoutTeacher(token);
      } catch {
        // Local logout should still complete even if the session is already gone.
      }
    }
    router.push("/login");
  }

  return (
    <header className="h-16 shrink-0 border-b border-border bg-card px-3 sm:px-5 flex items-center gap-3 sm:gap-6">
      <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
        <Logo size={32} />
        <span className="font-semibold text-[15px] text-foreground hidden sm:inline">ShikshaSetu</span>
      </Link>

      <nav className="hidden md:flex items-center gap-1 flex-1 min-w-0 overflow-x-auto">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors shrink-0",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1 min-w-0 md:hidden" />

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <Select value={interfaceLanguage} onValueChange={setInterfaceLanguage}>
          <SelectTrigger className="w-[110px] hidden lg:flex" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Hindi">हिंदी</SelectItem>
            <SelectItem value="Ho">Ho</SelectItem>
            <SelectItem value="Mundari">Mundari</SelectItem>
            <SelectItem value="Santhali">Santhali</SelectItem>
            <SelectItem value="English">English</SelectItem>
          </SelectContent>
        </Select>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background hover:bg-muted transition-colors"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4 text-foreground" />
              <span className="absolute -top-1 -right-1">
                <Badge className="h-4 min-w-4 px-1 rounded-full bg-destructive text-white text-[10px] justify-center">
                  3
                </Badge>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {NOTIFICATIONS.map((n) => (
              <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-0.5 py-2.5">
                <span className="text-sm font-medium">{n.title}</span>
                <span className="text-xs text-muted-foreground">{n.detail}</span>
                <span className="text-[11px] text-muted-foreground/70">{n.time}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 sm:gap-2 rounded-full pl-1 pr-1.5 sm:pr-2 py-1 hover:bg-muted transition-colors">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                  {teacher ? initials(teacher.name) : "…"}
                </AvatarFallback>
              </Avatar>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col items-start gap-0.5">
              <span className="text-sm font-medium">{teacherName}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {teacherLang && studentLang ? `${teacherLang} → ${studentLang}` : schoolName}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <User className="h-4 w-4" /> My Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings className="h-4 w-4" /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleLogout}>
              <LogOut className="h-4 w-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
