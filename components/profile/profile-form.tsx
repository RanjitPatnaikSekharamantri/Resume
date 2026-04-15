"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  profileUpdateSchema,
  type ProfileUpdateInput,
} from "@/lib/validations/profile";

type Props = {
  defaultValues: Partial<ProfileUpdateInput>;
};

export function ProfileForm({ defaultValues }: Props) {
  const [status, setStatus] = useState<string>("");
  const form = useForm<ProfileUpdateInput>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      name: defaultValues.name ?? "",
      email: defaultValues.email ?? "",
      phone: defaultValues.phone ?? "",
      location: defaultValues.location ?? "",
      linkedin: defaultValues.linkedin ?? "",
      links: defaultValues.links ?? [],
      workAuthorization: defaultValues.workAuthorization ?? "",
      summary: defaultValues.summary ?? "",
      preferences: defaultValues.preferences ?? {},
      equalOpportunity: defaultValues.equalOpportunity ?? {},
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setStatus("Saving...");
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      setStatus("Unable to save profile.");
      return;
    }
    setStatus("Saved profile.");
  });

  return (
    <Card className="border-zinc-200 bg-white">
      <CardHeader>
        <CardTitle className="text-zinc-900">Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...form.register("name")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...form.register("email")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...form.register("phone")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" {...form.register("location")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="linkedin">LinkedIn</Label>
              <Input id="linkedin" {...form.register("linkedin")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workAuthorization">Work authorization</Label>
              <Input
                id="workAuthorization"
                {...form.register("workAuthorization")}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="summary">Professional summary</Label>
            <Textarea id="summary" rows={6} {...form.register("summary")} />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving..." : "Save profile"}
            </Button>
            <p className="text-sm text-zinc-500">{status}</p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
