import { FileText, Download, CheckCheck } from "lucide-react";
import { Image } from "antd";
import type { Message, MessageAttachment } from "../../utils/types";

const resolveUrl = (url: string) => {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  const base = process.env.NEXT_PUBLIC_BACKEND_ORIGIN || "";
  return base ? `${base}${url}` : url;
};

const formatBytes = (bytes?: number) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const AttachmentRenderer = ({ attachment, isOut }: { attachment: MessageAttachment; isOut: boolean }) => {
  const url = resolveUrl(attachment.url);

  if (attachment.kind === "image") {
    return (
      <Image
        src={url}
        alt={attachment.file_name}
        className="!rounded-lg"
        style={{ maxWidth: 220, maxHeight: 220, objectFit: "cover" }}
      />
    );
  }

  if (attachment.kind === "video") {
    return (
      <video controls src={url} className="rounded-lg" style={{ maxWidth: 240 }}>
        Your browser does not support video playback.
      </video>
    );
  }

  if (attachment.kind === "audio") {
    return <audio controls src={url} className="w-full" />;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download={attachment.file_name}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
        isOut
          ? "border-primary/40 bg-primary/30 text-white"
          : "border-slate-200 bg-white text-slate-700"
      } hover:opacity-90`}
    >
      <FileText size={16} />
      <div className="flex-1 truncate">
        <p className="truncate font-medium">{attachment.file_name || "Attachment"}</p>
        {attachment.size ? <p className="opacity-70">{formatBytes(attachment.size)}</p> : null}
      </div>
      <Download size={14} />
    </a>
  );
};

export const MessageBubble = ({ message }: { message: Message }) => {
  // user = patient (incoming LEFT), ai/human = staff/AI (outgoing RIGHT)
  const isOut = message.sender !== "user";
  const attachments = message.attachments || [];
  const isPlaceholderText = /^\[(image|video|audio|file|attachment)\]$/i.test(message.text || "");
  const showText = message.text && !(attachments.length > 0 && isPlaceholderText);

  const appt = message.metadata?.appointment as
    | { date?: string; doctor?: string }
    | undefined;

  return (
    <div className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[70%]`}>
        <div
          className={`rounded-2xl px-4 py-2.5 ${
            isOut
              ? "rounded-tr-sm bg-primary text-white shadow-sm"
              : "rounded-tl-sm border border-slate-100 bg-white text-slate-800 shadow-sm"
          }`}
        >
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-col gap-2">
              <Image.PreviewGroup>
                {attachments.map((att, i) => (
                  <AttachmentRenderer key={`${att.url}-${i}`} attachment={att} isOut={isOut} />
                ))}
              </Image.PreviewGroup>
            </div>
          )}

          {showText && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
              {message.text}
            </p>
          )}

          {appt && (
            <div
              className={`mt-2 rounded-lg border px-3 py-2 text-xs ${
                isOut
                  ? "border-primary/40 bg-primary/30"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <p className="font-semibold">✅ Appointment booked!</p>
              {appt.date && <p className="mt-0.5">📅 {appt.date}</p>}
              {appt.doctor && <p>{appt.doctor}</p>}
            </div>
          )}

          <div
            className={`mt-1.5 flex items-center gap-1 text-[11px] ${
              isOut ? "justify-end text-sky-100" : "text-slate-400"
            }`}
          >
            <span>{message.timestamp}</span>
            {isOut && <CheckCheck size={13} className="opacity-80" />}
          </div>
        </div>
      </div>
    </div>
  );
};
