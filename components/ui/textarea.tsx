"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-24 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm shadow-xs transition-colors outline-none placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-blue-600",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
