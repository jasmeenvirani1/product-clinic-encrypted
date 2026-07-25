"use client";

import { Alert, Button, Form, Image } from "antd";
import type { UploadFile } from "antd";
import { FileText, ImageIcon, Plus, UploadCloud, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type Dispatch, type SetStateAction, useState } from "react";
import { useAppSelector } from "@/hooks/useAppSelector";
import { userService } from "@/services/user.service";
import Upload from "antd/es/upload";
import { MAX_UPLOAD_LABEL, beforeUploadWithSizeLimit } from "@/utils/fileSize";

const ACCEPTED_DOCUMENTS = "image/*,.pdf";

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const isImageFile = (file: UploadFile): boolean => {
  const origin = file.originFileObj as File | undefined;
  if (origin?.type?.startsWith("image/")) return true;
  return /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(file.name || "");
};

const isPdfFile = (file: UploadFile): boolean => {
  const origin = file.originFileObj as File | undefined;
  if (origin?.type === "application/pdf") return true;
  return /\.pdf$/i.test(file.name || "");
};

const withImageThumb = (files: UploadFile[]): UploadFile[] =>
  files.map((file) => {
    if (!file.thumbUrl && !file.url && isImageFile(file)) {
      const origin = file.originFileObj as File | undefined;
      if (origin) {
        return { ...file, thumbUrl: URL.createObjectURL(origin) };
      }
    }
    return file;
  });

const getImagePreviewSrc = (file: UploadFile): string | undefined => {
  if (!isImageFile(file)) return undefined;
  return file.thumbUrl || file.url;
};

function DocumentPreviewList({
  files,
  onRemove,
}: {
  files: UploadFile[];
  onRemove: (_uid: string) => void;
}) {
  if (!files.length) return null;

  return (
    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {files.map((file) => {
        const origin = file.originFileObj as File | undefined;
        const previewSrc = getImagePreviewSrc(file);

        return (
          <div
            key={file.uid}
            className="relative overflow-hidden rounded-xl border border-slate-200 bg-white"
          >
            <Button
              type="default"
              size="small"
              icon={<X size={14} />}
              onClick={() => onRemove(file.uid)}
              aria-label={`Remove ${file.name}`}
              className="absolute right-2 top-2 z-10"
            />
            <div className="h-48 w-full bg-slate-100">
              {previewSrc ? (
                <Image
                  src={previewSrc}
                  alt={file.name}
                  width="100%"
                  height={192}
                  style={{ objectFit: "cover" }}
                />
              ) : isPdfFile(file) ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                  <FileText size={28} className="text-rose-500" />
                  <p className="line-clamp-2 text-xs font-medium text-slate-700">{file.name}</p>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <ImageIcon size={22} className="text-slate-500" />
                </div>
              )}
            </div>
            <div className="border-t border-slate-100 px-3 py-2">
              <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
              <p className="text-xs text-slate-500">
                {isPdfFile(file) ? "PDF" : isImageFile(file) ? "Image" : "Document"}
                {formatFileSize(origin?.size) ? ` - ${formatFileSize(origin?.size)}` : ""}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DocumentUploadField({
  label,
  description,
  files,
  setFiles,
}: {
  label: string;
  description: string;
  files: UploadFile[];
  setFiles: Dispatch<SetStateAction<UploadFile[]>>;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-slate-800">{label}</span>
        <span className="shrink-0 text-xs text-slate-400">PDF or image · Max {MAX_UPLOAD_LABEL}</span>
      </div>
      <p className="text-xs text-slate-500">{description}</p>

      {files.length === 0 ? (
        <Upload.Dragger
          fileList={files}
          beforeUpload={beforeUploadWithSizeLimit}
          onChange={({ fileList }) => setFiles(withImageThumb(fileList))}
          onRemove={(file) => {
            setFiles((prev) => prev.filter((item) => item.uid !== file.uid));
            return false;
          }}
          accept={ACCEPTED_DOCUMENTS}
          multiple
          showUploadList={false}
          className="!rounded-2xl !border-slate-300 !bg-slate-50/70"
        >
          <div className="flex flex-col items-center justify-center gap-2 py-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-primary">
              <UploadCloud size={18} />
            </div>
            <p className="text-sm font-semibold text-slate-800">Drag &amp; drop files</p>
            <p className="text-xs text-slate-500">or click to browse · multiple supported</p>
          </div>
        </Upload.Dragger>
      ) : null}
      <DocumentPreviewList
        files={files}
        onRemove={(uid) => setFiles((prev) => prev.filter((item) => item.uid !== uid))}
      />
      {files.length > 0 ? (
        <Upload
          fileList={files}
          beforeUpload={beforeUploadWithSizeLimit}
          onChange={({ fileList }) => setFiles(withImageThumb(fileList))}
          accept={ACCEPTED_DOCUMENTS}
          multiple
          showUploadList={false}
        >
          <button
            type="button"
            className="mt-1 inline-flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
          >
            <Plus size={16} />
            Upload more
          </button>
        </Upload>
      ) : null}
    </div>
  );
}

export default function UploadDocumentsPage() {
  const router = useRouter();
  const { user } = useAppSelector((state) => state.auth);

  const [idProofFiles, setIdProofFiles] = useState<UploadFile[]>([]);
  const [addressProofFiles, setAddressProofFiles] = useState<UploadFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dashboardPath =
    user?.role === "super_admin" ? "/super-admin/dashboard" : "/app/dashboard";

  const getFileList = (list: UploadFile[]): File[] =>
    list.map((f) => f.originFileObj as File).filter(Boolean);

  const handleContinue = () => {
    router.push(dashboardPath);
  };

  const handleSubmit = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      await userService.update(user.id, {
        id_proof: getFileList(idProofFiles),
        address_proof: getFileList(addressProofFiles),
      });
      handleContinue();
    } catch {
      setError("Failed to upload documents. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-slate-900">Upload your documents</h2>
        <p className="text-sm text-slate-500">
          Upload your ID and address proof to complete your profile. You can skip this step and do it later.
        </p>
      </div>

      {error ? <Alert type="error" showIcon message={error} /> : null}

      <Form className="auth-form" layout="vertical" onFinish={handleSubmit}>
        <div className="space-y-5">
          <DocumentUploadField
            label="ID Proof (optional)"
            description="Passport, driving license, or national ID."
            files={idProofFiles}
            setFiles={setIdProofFiles}
          />

          <DocumentUploadField
            label="Address Proof (optional)"
            description="Utility bill, bank statement, or rental agreement."
            files={addressProofFiles}
            setFiles={setAddressProofFiles}
          />

          <Button type="primary" htmlType="submit" block size="large" loading={loading}>
            Save &amp; Continue
          </Button>
        </div>
      </Form>

      <p className="text-center text-sm text-slate-500">
        <button
          type="button"
          onClick={handleContinue}
          className="auth-link bg-transparent border-none cursor-pointer p-0"
        >
          Skip for now
        </button>
      </p>
    </div>
  );
}
