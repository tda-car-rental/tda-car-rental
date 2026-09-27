"use client";

import * as React from "react";
import { format, parse } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function DatePicker({
  value,
  onChange,
  format: dateFormat,
  placeholder,
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  format: string;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const parsed = value ? parse(value, dateFormat, new Date()) : undefined;
  const selected = parsed && !Number.isNaN(parsed.getTime()) ? parsed : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="default"
          aria-label={ariaLabel}
          className={cn(
            "h-9 w-full justify-start rounded-md border-input bg-transparent px-3 py-1 font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="size-4" />
          <span>{value || placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(day) => onChange(day ? format(day, dateFormat) : "")}
        />
      </PopoverContent>
    </Popover>
  );
}

export { DatePicker };
