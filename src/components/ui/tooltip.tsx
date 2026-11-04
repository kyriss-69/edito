"use client";

import { Tooltip as TooltipPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

import { Kbd } from "./kbd";

function TooltipProvider({
  delayDuration = 300,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />;
}

const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

function TooltipContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 flex items-center gap-2 rounded-md bg-foreground px-2 py-1 text-xs text-background animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}

/** Infobulle sur un élément (avec, au besoin, son raccourci clavier). */
function Hint({
  label,
  shortcut,
  side,
  children,
}: {
  label: React.ReactNode;
  shortcut?: string;
  side?: React.ComponentProps<typeof TooltipPrimitive.Content>["side"];
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>
        {label}
        {shortcut && <Kbd className="border-background/20 bg-background/10 text-background">{shortcut}</Kbd>}
      </TooltipContent>
    </Tooltip>
  );
}

export { Hint, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
