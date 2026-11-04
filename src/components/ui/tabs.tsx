"use client";

import { Tabs as TabsPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

/** Classes partagées par les onglets et les sélecteurs segmentés. */
export const segmentedList = "inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5 text-muted-foreground";
export const segmentedItem =
  "inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium whitespace-nowrap transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-xs aria-[current=page]:bg-card aria-[current=page]:text-foreground aria-[current=page]:shadow-xs [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5";

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn(segmentedList, className)} {...props} />;
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return <TabsPrimitive.Trigger className={cn(segmentedItem, className)} {...props} />;
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("outline-none", className)} {...props} />;
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
