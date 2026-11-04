"use client";

import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

import { segmentedItem, segmentedList } from "./tabs";

/** Sélecteur segmenté (un ou plusieurs choix). */
function ToggleGroup({ className, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return <ToggleGroupPrimitive.Root className={cn(segmentedList, className)} {...props} />;
}

function ToggleGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return <ToggleGroupPrimitive.Item className={cn(segmentedItem, className)} {...props} />;
}

export { ToggleGroup, ToggleGroupItem };
