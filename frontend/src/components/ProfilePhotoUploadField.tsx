"use client";

import type { Dispatch, SetStateAction } from "react";
import { Button, Form, Image, Upload } from "antd";
import type { UploadFile } from "antd";
import { ImagePlus, Plus, UploadCloud, X } from "lucide-react";
import {
  PROFILE_IMAGE_ACCEPT,
  beforeUploadProfileImage,
  formatFileSize,
  resolveProfileImageUrl,
  withImageThumb,
} from "@/utils/profileImage";
import { MAX_UPLOAD_LABEL } from "@/utils/fileSize";

interface ProfilePhotoUploadFieldProps {
  files: UploadFile[];
  setFiles: Dispatch<SetStateAction<UploadFile[]>>;
  existingImagePath?: string | null;
  removeExisting?: boolean;
  onRemoveExistingChange?: (_value: boolean) => void;
  label?: string;
  description?: string;
}

export function ProfilePhotoUploadField({
  files,
  setFiles,
  existingImagePath,
  removeExisting = false,
  onRemoveExistingChange,
  label = "Profile Photo",
  description = `JPG, JPEG, PNG, or WEBP. Max size ${MAX_UPLOAD_LABEL}.`,
}: ProfilePhotoUploadFieldProps) {
  const existingSrc = !removeExisting ? resolveProfileImageUrl(existingImagePath) : null;
  const activeFile = files[0];
  const localSrc = activeFile?.thumbUrl || activeFile?.url || null;
  const previewSrc = localSrc || existingSrc;

  const onFilesChange = (nextFiles: UploadFile[]) => {
    const next = withImageThumb(nextFiles.slice(-1));
    setFiles(next);
    if (next.length > 0) onRemoveExistingChange?.(false);
  };

  const clearSelection = () => {
    if (files.length > 0) {
      setFiles([]);
      return;
    }
    if (existingSrc) {
      onRemoveExistingChange?.(true);
    }
  };

  return (
    <Form.Item
      label={<span className="text-sm font-semibold text-slate-800">{label}</span>}
      extra={<span className="text-xs text-slate-500">{description}</span>}
    >
      {!previewSrc ? (
        <Upload.Dragger
          fileList={files}
          beforeUpload={beforeUploadProfileImage}
          onChange={({ fileList }) => onFilesChange(fileList)}
          accept={PROFILE_IMAGE_ACCEPT}
          multiple={false}
          showUploadList={false}
          className="rounded-2xl border-slate-300 bg-slate-50/70"
        >
          <div className="py-4">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-primary">
              <UploadCloud size={20} />
            </div>
            <p className="text-sm font-semibold text-slate-800">Drag and drop photo here</p>
            <p className="mt-1 text-xs text-slate-500">Click to browse and upload profile image</p>
          </div>
        </Upload.Dragger>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="h-44 w-full bg-slate-100">
            <Image src={previewSrc} alt="Profile preview" width="100%" height={176} style={{ objectFit: "cover" }} />
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">
                {activeFile?.name ?? "Current profile image"}
              </p>
              <p className="text-xs text-slate-500">
                {activeFile ? formatFileSize((activeFile.originFileObj as File | undefined)?.size) : "Existing image"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearSelection}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400"
              >
                <X size={13} />
                Remove
              </button>
              <Upload
                fileList={files}
                beforeUpload={beforeUploadProfileImage}
                onChange={({ fileList }) => onFilesChange(fileList)}
                accept={PROFILE_IMAGE_ACCEPT}
                multiple={false}
                showUploadList={false}
              >
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400"
                >
                  <Plus size={13} />
                  Replace
                </button>
              </Upload>
            </div>
          </div>
        </div>
      )}

      {previewSrc ? (
        <Upload
          fileList={files}
          beforeUpload={beforeUploadProfileImage}
          onChange={({ fileList }) => onFilesChange(fileList)}
          accept={PROFILE_IMAGE_ACCEPT}
          multiple={false}
          showUploadList={false}
        >
          <Button type="default" className="mt-3" icon={<ImagePlus size={14} />}>
            Click to upload another
          </Button>
        </Upload>
      ) : null}
    </Form.Item>
  );
}
