"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, Globe, School, ShieldCheck, User, Check, Camera, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { LANGUAGES } from "@/lib/mock-data";
import { LANGUAGE_CODE_TO_NAME, LANGUAGE_NAME_TO_CODE } from "@/lib/api";
import { useTeacherAuth } from "@/lib/teacher-auth";

function initials(name: string) {
  if (!name) return "T";
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function SettingsPage() {
  const { teacher, updateTeacher } = useTeacherAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [teacherLang, setTeacherLang] = useState("Hindi");
  const [studentLang, setStudentLang] = useState("Santhali");

  const [notifyReports, setNotifyReports] = useState(true);
  const [notifyGaps, setNotifyGaps] = useState(true);
  const [notifyDigest, setNotifyDigest] = useState(false);

  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    if (teacher) {
      setName(teacher.name ?? "");
      setEmail(teacher.email ?? "");
      setPhone(teacher.phone ?? "");
      setSchoolName(teacher.school_name ?? "");
      if (teacher.default_teacher_language) {
        setTeacherLang(LANGUAGE_CODE_TO_NAME[teacher.default_teacher_language] ?? "Hindi");
      }
      if (teacher.default_student_language) {
        setStudentLang(LANGUAGE_CODE_TO_NAME[teacher.default_student_language] ?? "Santhali");
      }
    }
  }, [teacher]);

  function triggerPhotoUpload() {
    fileInputRef.current?.click();
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setFeedback("Error: Photo size must be under 5MB.");
      setTimeout(() => setFeedback(null), 4000);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        updateTeacher({ avatar_url: dataUrl });
        setFeedback("Profile photo updated successfully!");
        setTimeout(() => setFeedback(null), 3000);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function handleRemovePhoto() {
    updateTeacher({ avatar_url: null });
    setIsPreviewOpen(false);
    setFeedback("Profile photo removed.");
    setTimeout(() => setFeedback(null), 3000);
  }

  function handleSaveChanges() {
    updateTeacher({
      name,
      email,
      phone,
      school_name: schoolName,
      default_teacher_language: LANGUAGE_NAME_TO_CODE[teacherLang] ?? "hi",
      default_student_language: LANGUAGE_NAME_TO_CODE[studentLang] ?? "sat",
    });
    setFeedback("Settings saved successfully!");
    setTimeout(() => setFeedback(null), 3000);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <PageHeader title="Settings" subtitle="Manage your profile, classroom and notification preferences." />

      {feedback && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          <Check className="h-4 w-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Hidden File Input for Profile Photo Upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/png, image/jpeg, image/webp, image/gif"
        className="hidden"
        onChange={handlePhotoChange}
      />

      {/* Full Photo Modal Preview Lightbox */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-3xl p-5 bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Profile Photo Preview
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 flex flex-col items-center justify-center p-3 rounded-xl bg-muted/40 overflow-hidden border border-border min-h-[320px]">
            {teacher?.avatar_url ? (
              <img
                src={teacher.avatar_url}
                alt={teacher.name || "Profile Photo"}
                className="max-h-[75vh] w-auto max-w-full rounded-lg object-contain shadow-md"
              />
            ) : (
              <p className="text-sm text-muted-foreground">No profile photo uploaded.</p>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 mt-4 pt-2 border-t border-border">
            {teacher?.avatar_url ? (
              <Button variant="ghost" size="sm" onClick={handleRemovePhoto} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4 mr-1.5" /> Remove Photo
              </Button>
            ) : <div />}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setIsPreviewOpen(false); triggerPhotoUpload(); }}>
                <Camera className="h-4 w-4 mr-1.5" /> Change Photo
              </Button>
              <Button variant="default" size="sm" onClick={() => setIsPreviewOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-5">
          <User className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-foreground">Teacher Profile</h3>
        </div>
        <div className="flex items-center gap-4 mb-6">
          <button
            type="button"
            onClick={() => {
              if (teacher?.avatar_url) {
                setIsPreviewOpen(true);
              } else {
                triggerPhotoUpload();
              }
            }}
            className="relative group rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer shrink-0"
            title={teacher?.avatar_url ? "Click to view photo in full size" : "Click to upload photo"}
          >
            <Avatar className="h-16 w-16 border border-border transition-transform group-hover:scale-105">
              {teacher?.avatar_url && (
                <AvatarImage src={teacher.avatar_url} alt={teacher.name} />
              )}
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                {teacher ? initials(name || teacher.name) : "…"}
              </AvatarFallback>
            </Avatar>
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={triggerPhotoUpload} className="gap-1.5">
              <Camera className="h-3.5 w-3.5" />
              Upload Photo
            </Button>
            {teacher?.avatar_url && (
              <Button variant="ghost" size="sm" onClick={handleRemovePhoto} className="gap-1.5 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </Button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Arshita" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. teacher@gmail.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
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
            <Input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="Enter school name" />
          </div>
          <div className="space-y-1.5">
            <Label>Default Teacher Language</Label>
            <Select value={teacherLang} onValueChange={setTeacherLang}>
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
            <Select value={studentLang} onValueChange={setStudentLang}>
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
        <Button variant="outline" onClick={() => {
          if (teacher) {
            setName(teacher.name ?? "");
            setEmail(teacher.email ?? "");
            setPhone(teacher.phone ?? "");
            setSchoolName(teacher.school_name ?? "");
          }
        }}>
          Cancel
        </Button>
        <Button onClick={handleSaveChanges}>Save Changes</Button>
      </div>
    </div>
  );
}
