"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Modal, Tooltip } from "antd";
import { CircleHelp, Play } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAppSelector } from "@/hooks/useAppSelector";
import { guideService } from "@/services/guide.service";
import type { VideoRecord } from "@/utils/types";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api").replace(/\/api$/, "");

interface PageSectionProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  /**
   * Override the auto-derived menu slug used to look up the help video.
   * Defaults to the slug derived from the current pathname (e.g.
   * `/app/leads` → `app-leads`, `/super-admin/tenants` → `sa-tenants`).
   * Pass `false` to disable the help button on this page.
   */
  helpMenuSlug?: string | false;
}

function deriveMenuSlugFromPath(pathname: string | null): string | null {
  if (!pathname) return null;
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const [root, segment] = parts;
  if (root === "app") return `app-${segment}`;
  if (root === "super-admin") return `sa-${segment}`;
  return null;
}

export const PageSection = ({ title, description, actions, helpMenuSlug }: PageSectionProps) => {
  const pathname = usePathname();
  const role = useAppSelector((state) => state.auth.user?.role);

  const slug =
    helpMenuSlug === false
      ? null
      : helpMenuSlug ?? deriveMenuSlugFromPath(pathname);

  const [video, setVideo] = useState<VideoRecord | null>(null);
  const [open, setOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Staff users do not get the help link.
  const helpEnabled = !!slug && role !== "staff_user";

  useEffect(() => {
    if (!helpEnabled || !slug) {
      setVideo(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const found = await guideService.getByMenuSlug(slug);
        if (!cancelled) setVideo(found);
      } catch {
        if (!cancelled) setVideo(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [helpEnabled, slug]);

  const closeVideo = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    setOpen(false);
  };

  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-[24px] font-semibold leading-tight text-slate-900">{title}</h1>
          {video ? (
            <Tooltip title="How it's work ?">
              <a
                role="button"
                aria-label="Watch help video"
                tabIndex={0}
                onClick={(e) => {
                  e.preventDefault();
                  setOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpen(true);
                  }
                }}
                className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100"
              >
                <CircleHelp size={14} />
              </a>
            </Tooltip>
          ) : null}
        </div>
        {description && <p className="text-xs text-slate-500 mt-1">{description}</p>}
      </div>

      {actions ? <div className="flex items-center gap-3 shrink-0">{actions}</div> : null}

      <Modal
        open={open}
        onCancel={closeVideo}
        afterOpenChange={(v) => {
          if (v && videoRef.current) void videoRef.current.play();
        }}
        footer={null}
        width="90vw"
        style={{ maxWidth: 1100, top: 20 }}
        destroyOnClose
        title={
          <span className="inline-flex items-center gap-2">
            <Play size={16} className="text-blue-500" />
            {video?.title}
          </span>
        }
      >
        {video && (
          <div className="space-y-3">
            <video
              ref={videoRef}
              src={`${API_BASE}/uploads/videos/${video.file_path}`}
              controls
              autoPlay
              className="w-full rounded-lg bg-black"
              style={{ maxHeight: "80vh" }}
            />
            {video.description && <p className="text-sm text-slate-500">{video.description}</p>}
            {video.Menu?.name && (
              <p className="text-xs text-slate-400">For menu: {video.Menu.name}</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
