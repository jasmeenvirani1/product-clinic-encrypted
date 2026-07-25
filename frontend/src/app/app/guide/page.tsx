"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { App, Card, Empty, Modal, Spin } from "antd";
import { Play } from "lucide-react";
import { PageSection } from "@/components/PageSection";
import { guideService } from "@/services/guide.service";
import type { VideoRecord } from "@/utils/types";
import { formatDate as formatUiDate } from "@/lib/utils";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api").replace(/\/api$/, "");

/** Backend may return created_at or createdAt depending on raw vs model */
function formatDate(record: VideoRecord): string {
  const raw = record.createdAt || record.created_at;
  if (!raw) return "";
  const d = new Date(raw as string);
  return isNaN(d.getTime()) ? "" : formatUiDate(d);
}

export default function GuidePage() {
  const { message } = App.useApp();
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<VideoRecord | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await guideService.getVideos();
      setVideos(data);
    } catch {
      void message.error("Failed to load guide videos.");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { void load(); }, [load]);

  const openVideo = (video: VideoRecord) => {
    setSelected(video);
  };

  const closeVideo = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    setSelected(null);
  };

  return (
    <div className="">
      <PageSection
        eyebrow="Resources"
        title="Video Guide"
        description="Watch platform training videos and tutorials to get the most out of your CRM."
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <Spin size="large" />
        </div>
      ) : videos.length === 0 ? (
        <Card className="crm-card border-0">
          <Empty description="No guide videos available yet." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {videos.map((video) => (
            <Card
              key={video.id}
              hoverable
              className="crm-card overflow-hidden border-0 !p-0"
              styles={{ body: { padding: 0 } }}
              onClick={() => openVideo(video)}
            >
              {/* Thumbnail — large */}
              <div className="group relative aspect-video w-full overflow-hidden bg-slate-100">
                {video.thumbnail ? (
                  <img
                    src={`${API_BASE}/uploads/videos/${video.thumbnail}`}
                    alt={video.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                    <Play size={64} className="text-white/30" />
                  </div>
                )}
                {/* Play overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-300 group-hover:bg-black/40">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 opacity-0 shadow-xl transition-all duration-300 group-hover:opacity-100 group-hover:scale-110">
                    <Play size={28} className="ml-1 text-slate-800" fill="currentColor" />
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="p-5">
                <h3 className="text-base font-semibold text-slate-900 line-clamp-1">{video.title}</h3>
                {video.description && (
                  <p className="mt-1.5 text-sm text-slate-500 line-clamp-2">{video.description}</p>
                )}
                <div className="mt-3 flex items-center justify-between gap-2">
                  {video.Menu?.name ? (
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600">
                      For: {video.Menu.name}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">General</span>
                  )}
                  {formatDate(video) && (
                    <span className="text-xs text-slate-400">{formatDate(video)}</span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Video Player Modal — full width, auto-plays */}
      <Modal
        open={!!selected}
        onCancel={closeVideo}
        afterOpenChange={(open) => {
          if (open && videoRef.current) void videoRef.current.play();
        }}
        footer={null}
        width="90vw"
        style={{ maxWidth: 1200, top: 20 }}
        destroyOnClose
        title={selected?.title}
      >
        {selected && (
          <div className="space-y-3">
            <video
              ref={videoRef}
              src={`${API_BASE}/uploads/videos/${selected.file_path}`}
              controls
              autoPlay
              className="w-full rounded-lg bg-black"
              style={{ maxHeight: "80vh" }}
            />
            {selected.description && (
              <p className="text-sm text-slate-500">{selected.description}</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
