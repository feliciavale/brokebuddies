"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

/** Dropdown with checkboxes: who ate or shared this item. */
export function MemberPicker({
  members,
  selected,
  onChange,
  label,
}: {
  members: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const names = members.filter((m) => selected.includes(m.id)).map((m) => m.name);
  const all = members.length > 1 && selected.length === members.length;
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  let text = "Who had this?";
  if (all) text = "Everyone";
  else if (names.length) text = names.join(", ");

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        className={`input flex items-center justify-between gap-2 text-left ${
          selected.length === 0 ? "border-tomato text-muted" : ""
        }`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="truncate">{text}</span>
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted">
          {selected.length > 1 && `Split ${selected.length} ways`}
          <ChevronDown size={14} aria-hidden />
        </span>
      </button>
      {open && (
        <div
          id={listId}
          className="absolute z-30 mt-1 w-full min-w-52 rounded-md border border-line bg-surface p-1 shadow-[0_8px_24px_rgba(77,26,0,0.18)]"
        >
          <button
            type="button"
            className="w-full rounded-sm px-3 py-2 text-left text-sm font-semibold hover:bg-bg"
            onClick={() => onChange(all ? [] : members.map((m) => m.id))}
          >
            {all ? "Clear everyone" : "Everyone shared this"}
          </button>
          {members.map((m) => (
            <label key={m.id} className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-bg">
              <input type="checkbox" checked={selected.includes(m.id)} onChange={() => toggle(m.id)} />
              {m.name}
            </label>
          ))}
          <p className="border-t border-line px-3 pt-2 pb-1 text-xs text-muted">
            Pick two or more people to split this item evenly.
          </p>
        </div>
      )}
    </div>
  );
}
