"use client";

import { useState } from "react";
import { Bell, Globe, School, ShieldCheck, User } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { LANGUAGES } from "@/lib/mock-data";
import { LANGUAGE_CODE_TO_NAME } from "@/lib/api";
import { useTeacherAuth } from "@/lib/teacher-auth";

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function SettingsPage() {
  const { teacher } = useTeacherAuth();
  const [notifyReports, setNotifyReports] = useState(true);
  const [notifyGaps, setNotifyGaps] = useState(true);
  const [notifyDigest, setNotifyDigest] = useState(false);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <PageHeader title="Settings" subtitle="Manage your profile, classroom and notification preferences." />

      <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-5">
          <User className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-foreground">Teacher Profile</h3>
        </div>
        <div className="flex items-center gap-4 mb-6">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
              {teacher ? initials(teacher.name) : "…"}
            </AvatarFallback>
          </Avatar>
          <Button variant="outline" size="sm" disabled>Change Photo</Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input defaultValue={teacher?.name ?? ""} key={teacher?.id ?? "loading"} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input defaultValue={teacher?.email ?? ""} key={`${teacher?.id ?? "loading"}-email`} />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input defaultValue={teacher?.phone ?? ""} key={`${teacher?.id ?? "loading"}-phone`} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-5">
          <School className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-foreground">School &amp; Classroom</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>School</Label>
            <Input defaultValue={teacher?.school_name ?? ""} key={`${teacher?.id ?? "loading"}-school`} placeholder="Not set" />
          </div>
          <div className="space-y-1.5">
            <Label>Default Teacher Language</Label>
            <Select
              defaultValue={teacher ? LANGUAGE_CODE_TO_NAME[teacher.default_teacher_language] : undefined}
              key={`${teacher?.id ?? "loading"}-tlang`}
            >
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Default Student Language</Label>
            <Select
              defaultValue={teacher ? LANGUAGE_CODE_TO_NAME[teacher.default_student_language] : undefined}
              key={`${teacher?.id ?? "loading"}-slang`}
            >
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-5">
          <Globe className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-foreground">Language Preferences</h3>
        </div>
        <div className="space-y-1.5 max-w-xs">
          <Label>Preferred Student Languages</Label>
          <p className="text-xs text-muted-foreground mb-2">
            Languages available for live translation and lesson generation.
          </p>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.filter((l) => l !== "Hindi").map((l) => (
              <span
                key={l}
                className="text-xs font-medium px-3 py-1.5 rounded-full bg-primary/10 text-primary"
              >
                {l}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-5">
          <Bell className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-foreground">Notifications</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Weekly performance reports</p>
              <p className="text-xs text-muted-foreground">Get a summary of class performance every week</p>
            </div>
            <Switch checked={notifyReports} onCheckedChange={setNotifyReports} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Learning gap alerts</p>
              <p className="text-xs text-muted-foreground">Be notified when AI detects a new learning gap</p>
            </div>
            <Switch checked={notifyGaps} onCheckedChange={setNotifyGaps} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Daily digest email</p>
              <p className="text-xs text-muted-foreground">Receive a daily summary of classroom activity</p>
            </div>
            <Switch checked={notifyDigest} onCheckedChange={setNotifyDigest} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-foreground">Data &amp; Privacy</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Student data is stored securely in accordance with the Jharkhand Smart
          Education Programme guidelines.
        </p>
        <Button variant="outline" size="sm">Download my data</Button>
      </section>

      <div className="flex justify-end gap-3">
        <Button variant="outline">Cancel</Button>
        <Button>Save Changes</Button>
      </div>
    </div>
  );
}
