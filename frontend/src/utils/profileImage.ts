import type { UploadFile } from "antd";
import { Upload, message as antdMessage } from "antd";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/utils/fileSize";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api").replace(/\/api$/, "");

export const PROFILE_IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";
export const PROFILE_IMAGE_REGEX = /\.(jpg|jpeg|png|webp)$/i;

export const formatFileSize = (bytes?: number): string => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const resolveProfileImageUrl = (value?: string | null): string | null => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `${API_BASE}/uploads/proofs/${value}`;
};

export const getInitial = (value?: string | null): string => {
  const first = value?.trim()?.charAt(0) ?? "";
  return first ? first.toUpperCase() : "?";
};

const isAllowedFile = (file: File | UploadFile): boolean => {
  const name = "name" in file ? file.name ?? "" : "";
  const mime = "type" in file ? file.type ?? "" : "";
  return PROFILE_IMAGE_REGEX.test(name) || /^image\/(jpeg|png|webp)$/i.test(mime);
};

export const beforeUploadProfileImage = (file: File): boolean | string => {
  if (!isAllowedFile(file)) {
    void antdMessage.error("Only JPG, JPEG, PNG, and WEBP images are allowed.");
    return Upload.LIST_IGNORE;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    void antdMessage.error(`"${file.name}" is larger than ${MAX_UPLOAD_LABEL}. Please choose a smaller file.`);
    return Upload.LIST_IGNORE;
  }
  return false;
};

export const withImageThumb = (files: UploadFile[]): UploadFile[] =>
  files.map((file) => {
    if (!file.thumbUrl && !file.url) {
      const origin = file.originFileObj as File | undefined;
      if (origin && isAllowedFile(origin)) {
        return { ...file, thumbUrl: URL.createObjectURL(origin) };
      }
    }
    return file;
  });
