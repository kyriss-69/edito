"use client";

import { addDays, format, nextMonday, startOfDay } from "date-fns";
import { CalendarX2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { DEFAULT_HOUR, moveToDay } from "@/lib/calendar";

/** Heure (HH:mm) d'une date, ou l'heure par défaut. */
function timeOf(value: number | null) {
  return value === null ? `${String(DEFAULT_HOUR).padStart(2, "0")}:00` : format(value, "HH:mm");
}

/** Remplace l'heure d'une date (« 18:30 »). */
function withTime(value: number, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date(value);
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date.getTime();
}

/**
 * Choix de la date de publication : raccourcis, calendrier et heure.
 * L'heure est conservée quand on change de jour (10:00 par défaut).
 */
export function SchedulePicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const today = startOfDay(new Date());
  const presets = [
    { label: "Aujourd'hui", day: today },
    { label: "Demain", day: addDays(today, 1) },
    { label: "Lundi prochain", day: nextMonday(today) },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <Button
            key={preset.label}
            type="button"
            variant="outline"
            size="sm"
            className="h-7 rounded-full px-2.5 text-xs"
            onClick={() => onChange(moveToDay(value, preset.day))}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      <Calendar
        mode="single"
        selected={value === null ? undefined : new Date(value)}
        defaultMonth={value === null ? undefined : new Date(value)}
        onSelect={(day) => day && onChange(moveToDay(value, day))}
      />
      <div className="flex items-center gap-2">
        <Input
          type="time"
          aria-label="Heure de publication"
          value={timeOf(value)}
          onChange={(e) => {
            if (!e.target.value) return;
            onChange(withTime(value ?? moveToDay(null, today), e.target.value));
          }}
          className="h-8 w-28"
        />
        {value !== null && (
          <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={() => onChange(null)}>
            <CalendarX2 /> Retirer la date
          </Button>
        )}
      </div>
    </div>
  );
}
