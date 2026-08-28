"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, Landmark, LogOut, Settings, User } from "lucide-react";
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
import { logoutTeacher } from "@/lib/api";
import { TEACHER_NAME, SCHOOL_NAME } from "@/lib/mock-data";

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

export function Header() {
  const router = useRouter();
  const [interfaceLanguage, setInterfaceLanguage] = useState("Hindi");

  async function handleLogout() {
    const token = localStorage.getItem("shikshasetu_teacher_token");
    localStorage.removeItem("shikshasetu_teacher_token");
    localStorage.removeItem("shikshasetu_teacher");
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
    <header className="h-16 shrink-0 border-b border-border bg-card px-4 md:px-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2.5 md:hidden">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Landmark className="h-4 w-4" />
        </div>
        <span className="font-semibold text-sm">ShikshaSetu</span>
      </div>

      <div className="hidden md:block">
        <p className="text-sm font-medium text-foreground">{TEACHER_NAME}</p>
        <p className="text-xs text-muted-foreground">{SCHOOL_NAME}</p>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <Select value={interfaceLanguage} onValueChange={setInterfaceLanguage}>
          <SelectTrigger className="w-[110px] hidden sm:flex" size="sm">
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
            <button className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-muted transition-colors">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                  AK
                </AvatarFallback>
              </Avatar>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col items-start gap-0.5">
              <span className="text-sm font-medium">{TEACHER_NAME}</span>
              <span className="text-xs font-normal text-muted-foreground">
                Class 2 · Mathematics &amp; Hindi
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
