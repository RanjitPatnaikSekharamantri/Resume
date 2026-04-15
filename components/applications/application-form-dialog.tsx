"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ApplicationStatus } from "@prisma/client";

import { APPLICATION_STATUS_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function ApplicationFormDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    jobTitle: "",
    company: "",
    location: "",
    salary: "",
    postedDate: "",
    jobDescription: "",
    jobUrl: "",
    source: "",
    notes: "",
    status: ApplicationStatus.SAVED,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add Application</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create application</DialogTitle>
          <DialogDescription>
            Track a new opportunity and its lifecycle.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              const response = await fetch("/api/applications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
              });
              if (!response.ok) return;
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Job Title</Label>
              <Input
                required
                value={form.jobTitle}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, jobTitle: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Company</Label>
              <Input
                required
                value={form.company}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, company: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Location</Label>
              <Input
                value={form.location}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, location: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Salary</Label>
              <Input
                value={form.salary}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, salary: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Posted Date</Label>
              <Input
                type="date"
                value={form.postedDate}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, postedDate: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, status: value as ApplicationStatus }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(ApplicationStatus).map((status) => (
                    <SelectItem key={status} value={status}>
                      {APPLICATION_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Job URL</Label>
            <Input
              value={form.jobUrl}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, jobUrl: event.target.value }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label>Source</Label>
            <Input
              value={form.source}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, source: event.target.value }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label>Job Description</Label>
            <Textarea
              value={form.jobDescription}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, jobDescription: event.target.value }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, notes: event.target.value }))
              }
            />
          </div>

          <Button disabled={isPending} className="w-full" type="submit">
            {isPending ? "Saving..." : "Save Application"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
