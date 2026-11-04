"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { DayPicker } from "react-day-picker";
import { fr } from "react-day-picker/locale/fr";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function Chevron({ orientation }: { orientation?: "up" | "down" | "left" | "right" }) {
  return orientation === "left" ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />;
}

/** Calendrier (sélection d'un jour), en français, semaine commençant le lundi. */
function Calendar({ className, classNames, ...props }: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      locale={fr}
      weekStartsOn={1}
      showOutsideDays
      className={cn("p-1 text-sm", className)}
      classNames={{
        months: "relative flex flex-col",
        month: "flex flex-col gap-3",
        nav: "absolute inset-x-0 top-0 flex items-center justify-between",
        button_previous: cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "z-10"),
        button_next: cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "z-10"),
        month_caption: "flex h-7 items-center justify-center",
        caption_label: "text-sm font-medium capitalize",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-9 text-[11px] font-normal text-muted-foreground capitalize",
        week: "mt-1 flex w-full",
        day: "relative size-9 p-0 text-center",
        day_button:
          "inline-flex size-9 items-center justify-center rounded-md text-sm tabular-nums transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50",
        selected:
          "[&>button]:bg-primary [&>button]:font-medium [&>button]:text-primary-foreground [&>button]:hover:bg-primary",
        today: "[&>button]:font-semibold [&:not([aria-selected=true])>button]:text-primary",
        outside: "text-muted-foreground/60",
        disabled: "text-muted-foreground opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{ Chevron }}
      {...props}
    />
  );
}

export { Calendar };
