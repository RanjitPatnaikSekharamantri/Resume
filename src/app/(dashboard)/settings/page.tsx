"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Shield, Key, Trash2, Plus, Loader2, Pencil, Mail, Lock,
} from "lucide-react";
import { ToastNotification, type ToastData } from "@/components/ui/toast-notification";
import {
  Select as TzSelect,
  SelectContent as TzSelectContent,
  SelectItem as TzSelectItem,
  SelectTrigger as TzSelectTrigger,
  SelectValue as TzSelectValue,
} from "@/components/ui/select";
import { getUserTimezone, setUserTimezone, TIMEZONE_OPTIONS, getTimezoneLabel, detectTimezone } from "@/lib/timezone";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Provider {
  id: string;
  name: string;
  model: string | null;
  isActive: boolean;
  keyLastFour: string;
}


export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession();
  const [timezone, setTimezoneState] = useState("auto");

  // Email change dialog
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailNew, setEmailNew] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);

  // Password change dialog
  const [pwOpen, setPwOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("ai-career-os-timezone");
      setTimezoneState(stored || "auto");
    }
  }, []);

  const handleTimezoneChange = (tz: string) => {
    setTimezoneState(tz);
    setUserTimezone(tz);
    setToast({ message: `Timezone set to ${getTimezoneLabel(tz)}`, variant: "success" });
  };

  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastData>(null);

  // Add/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formModel, setFormModel] = useState("");
  const [formKey, setFormKey] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Provider | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-providers");
      if (res.ok) setProviders(await res.json());
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProviders(); }, [fetchProviders]);

  const openAdd = () => {
    setEditId(null); setFormName("OpenAI"); setFormModel("gpt-4"); setFormKey(""); setDialogOpen(true);
  };

  const openEdit = (p: Provider) => {
    setEditId(p.id); setFormName(p.name); setFormModel(p.model || ""); setFormKey(""); setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      if (editId) {
        const body: Record<string, unknown> = { name: formName.trim(), model: formModel.trim() };
        if (formKey) body.apiKey = formKey;
        const res = await fetch(`/api/ai-providers/${editId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!res.ok) { setToast({ message: "Save failed", variant: "error" }); setSaving(false); return; }
        setToast({ message: "Provider updated", variant: "success" });
      } else {
        if (!formKey) { setToast({ message: "API key is required", variant: "error" }); setSaving(false); return; }
        const res = await fetch("/api/ai-providers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: formName.trim(), model: formModel.trim(), apiKey: formKey }) });
        if (!res.ok) { setToast({ message: "Save failed", variant: "error" }); setSaving(false); return; }
        setToast({ message: "Provider added", variant: "success" });
      }
      setDialogOpen(false);
      fetchProviders();
    } catch { setToast({ message: "Save failed", variant: "error" }); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch(`/api/ai-providers/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      fetchProviders();
      setToast({ message: "Provider deleted", variant: "success" });
    } catch { setToast({ message: "Delete failed", variant: "error" }); } finally { setDeleting(false); }
  };

  const handleToggle = async (p: Provider) => {
    await fetch(`/api/ai-providers/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !p.isActive }) });
    fetchProviders();
  };

  // ── change email ──

  const handleChangeEmail = async () => {
    if (!emailNew.trim() || !emailPassword) return;
    setEmailSaving(true);
    try {
      const res = await fetch("/api/account/email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail: emailNew.trim(), currentPassword: emailPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ message: data.error || "Failed to change email", variant: "error" });
        return;
      }
      await updateSession({ email: emailNew.trim() });
      setEmailOpen(false);
      setEmailNew("");
      setEmailPassword("");
      setToast({
        message: data.message || "Email updated",
        variant: "success",
      });
    } catch {
      setToast({ message: "Failed to change email", variant: "error" });
    } finally {
      setEmailSaving(false);
    }
  };

  // ── change password ──

  const handleChangePassword = async () => {
    if (!pwCurrent || !pwNew) return;
    if (pwNew !== pwConfirm) {
      setToast({ message: "New passwords don't match", variant: "error" });
      return;
    }
    setPwSaving(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ message: data.error || "Failed to change password", variant: "error" });
        return;
      }
      setPwOpen(false);
      setPwCurrent("");
      setPwNew("");
      setPwConfirm("");
      setToast({ message: data.message || "Password updated", variant: "success" });
    } catch {
      setToast({ message: "Failed to change password", variant: "error" });
    } finally {
      setPwSaving(false);
    }
  };

  const [testing, setTesting] = useState<string | null>(null);
  const handleTest = async (p: Provider) => {
    setTesting(p.id);
    try {
      const res = await fetch("/api/ai-providers/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ providerId: p.id }) });
      const data = await res.json();
      setToast({ message: data.message || (data.success ? "Connection OK" : "Test failed"), variant: data.success ? "success" : "error" });
    } catch { setToast({ message: "Test failed", variant: "error" }); }
    finally { setTesting(null); }
  };

  return (
    <>
      <PageHeader title="Settings" description="Manage your account and integrations" />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Shield className="w-4 h-4 text-gray-500" /> Account</CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Name</Label><Input value={session?.user?.name || ""} disabled className="bg-gray-50" /></div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Email</Label>
                  <button
                    type="button"
                    onClick={() => { setEmailNew(""); setEmailPassword(""); setEmailOpen(true); }}
                    className="text-[11px] text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Change
                  </button>
                </div>
                <Input value={session?.user?.email || ""} disabled className="bg-gray-50" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">To update your name, visit the Profile page.</p>

            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Lock className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Password</p>
                    <p className="text-xs text-gray-500">Update your password regularly for security</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setPwCurrent(""); setPwNew(""); setPwConfirm(""); setPwOpen(true); }}
                >
                  Change Password
                </Button>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Timezone</Label>
                  <TzSelect value={timezone} onValueChange={handleTimezoneChange}>
                    <TzSelectTrigger>
                      <TzSelectValue placeholder="Auto-detect" />
                    </TzSelectTrigger>
                    <TzSelectContent>
                      {TIMEZONE_OPTIONS.map((tz) => (
                        <TzSelectItem key={tz} value={tz}>
                          {getTimezoneLabel(tz)}
                        </TzSelectItem>
                      ))}
                    </TzSelectContent>
                  </TzSelect>
                  <p className="text-[11px] text-gray-400">
                    {timezone === "auto"
                      ? `Auto-detected: ${detectTimezone()}`
                      : "All dates and times will use this timezone"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2"><Key className="w-4 h-4 text-gray-500" /> AI Providers</CardTitle>
                <CardDescription className="mt-1">Manage API keys for AI-powered features</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-1.5" /> Add Provider</Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400 mx-auto" /></div>
            ) : providers.length === 0 ? (
              <div className="text-center py-10">
                <Key className="w-7 h-7 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No AI providers configured</p>
                <p className="text-xs text-gray-400 mt-0.5">The app uses built-in generation. Add an API key for enhanced outputs.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {providers.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn("w-2 h-2 rounded-full shrink-0", p.isActive ? "bg-emerald-500" : "bg-gray-300")} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900">{p.name}</p>
                          {p.model && <Badge variant="secondary" className="text-[10px]">{p.model}</Badge>}
                        </div>
                        <p className="text-xs text-gray-500 font-mono">{p.keyLastFour}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => handleTest(p)} disabled={testing === p.id} className="px-2 py-1 rounded text-[10px] font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50">{testing === p.id ? "Testing..." : "Test"}</button>
                      <button onClick={() => handleToggle(p)} className={cn("px-2 py-1 rounded text-[10px] font-medium transition-colors", p.isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500")}>{p.isActive ? "Active" : "Inactive"}</button>
                      <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setDeleteTarget(p)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base text-red-600">Danger Zone</CardTitle>
            <CardDescription>Irreversible actions for your account</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-lg border border-red-200 bg-red-50/50">
              <div><p className="text-sm font-medium text-gray-900">Delete Account</p><p className="text-xs text-gray-500 mt-0.5">Permanently delete your account and all data</p></div>
              <Button variant="destructive" size="sm">Delete Account</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Provider" : "Add AI Provider"}</DialogTitle>
            <DialogDescription>{editId ? "Update provider details" : "Configure a new AI API provider"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Provider Name</Label><Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="OpenAI" /></div>
            <div className="space-y-1.5"><Label>Model</Label><Input value={formModel} onChange={(e) => setFormModel(e.target.value)} placeholder="gpt-4o" /></div>
            <div className="space-y-1.5">
              <Label>API Key {editId && <span className="text-xs text-gray-400 font-normal">(leave blank to keep current)</span>}</Label>
              <Input type="password" value={formKey} onChange={(e) => setFormKey(e.target.value)} placeholder={editId ? "••••••••" : "sk-..."} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} disabled={saving || !formName.trim() || (!editId && !formKey)}>
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : editId ? "Save Changes" : "Add Provider"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Provider</DialogTitle>
            <DialogDescription>Delete {deleteTarget?.name}? This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deleting...</> : <><Trash2 className="w-4 h-4 mr-2" /> Delete</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Email Dialog */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-gray-500" />
              Change Email Address
            </DialogTitle>
            <DialogDescription>
              Enter your new email and current password. If email verification is
              enabled, you&apos;ll need to re-verify the new address before signing in again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Current Email</Label>
              <Input value={session?.user?.email || ""} disabled className="bg-gray-50" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-email">New Email</Label>
              <Input
                id="new-email"
                type="email"
                value={emailNew}
                onChange={(e) => setEmailNew(e.target.value)}
                placeholder="new@example.com"
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email-current-pw">Current Password</Label>
              <Input
                id="email-current-pw"
                type="password"
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailOpen(false)} disabled={emailSaving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleChangeEmail}
              disabled={emailSaving || !emailNew.trim() || !emailPassword}
            >
              {emailSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Updating...</> : "Update Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-gray-500" />
              Change Password
            </DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new one (8+ characters).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pw-current">Current Password</Label>
              <Input
                id="pw-current"
                type="password"
                value={pwCurrent}
                onChange={(e) => setPwCurrent(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw-new">New Password</Label>
              <Input
                id="pw-new"
                type="password"
                value={pwNew}
                onChange={(e) => setPwNew(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw-confirm">Confirm New Password</Label>
              <Input
                id="pw-confirm"
                type="password"
                value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)}
                autoComplete="new-password"
              />
              {pwConfirm && pwNew !== pwConfirm && (
                <p className="text-[11px] text-red-600">Passwords don&apos;t match</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwOpen(false)} disabled={pwSaving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleChangePassword}
              disabled={
                pwSaving ||
                !pwCurrent ||
                !pwNew ||
                pwNew.length < 8 ||
                pwNew !== pwConfirm
              }
            >
              {pwSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Updating...</> : "Update Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {toast && <ToastNotification data={toast} onDismiss={() => setToast(null)} />}
    </>
  );
}
