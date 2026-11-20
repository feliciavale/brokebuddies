"use client";

import { Share2 } from "lucide-react";
import { useSyncExternalStore } from "react";
import { CopyButton } from "./copy-button";
import { site } from "@/lib/site";

const subscribe = () => () => {};

export function InviteLink({ path }: { path: string }) {
  const origin = useSyncExternalStore(subscribe, () => window.location.origin, () => "");
  const canShare = useSyncExternalStore(subscribe, () => "share" in navigator, () => false);
  const url = origin + path;
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        className="input font-mono text-xs"
        readOnly
        value={url}
        aria-label="Invite link"
        onFocus={(e) => e.target.select()}
      />
      <div className="flex gap-2">
        <CopyButton text={url} label="Copy link" />
        {canShare && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => navigator.share({ title: `Join my group on ${site.name}`, url }).catch(() => {})}
          >
            <Share2 size={14} aria-hidden />
            Share
          </button>
        )}
      </div>
    </div>
  );
}
