"use client";

import { useMemo, useState } from "react";
import { Button, Image, Modal, Space, Tooltip } from "antd";
import { FileImage, FileText, Paperclip } from "lucide-react";

const IMAGE_EXT_RE = /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i;
const PDF_EXT_RE = /\.pdf$/i;

export const isImageAttachment = (path: string): boolean => IMAGE_EXT_RE.test(path);
export const isPdfAttachment = (path: string): boolean => PDF_EXT_RE.test(path);

const buildAttachmentUrl = (baseUrl: string, filePath: string): string =>
  `${baseUrl}/${encodeURIComponent(filePath)}`;

function AttachmentIcon({
  filePath,
  baseUrl,
  showLabel = false,
  label,
}: {
  filePath: string;
  baseUrl: string;
  showLabel?: boolean;
  label?: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const fileUrl = useMemo(() => buildAttachmentUrl(baseUrl, filePath), [baseUrl, filePath]);
  const name = filePath.split("/").pop() ?? filePath;
  const displayLabel = label ?? name;

  if (isImageAttachment(filePath)) {
    return (
      <>
        <Tooltip title={name}>
          <Button
            type="text"
            size="small"
            className="!rounded-lg hover:!bg-indigo-50"
            icon={<FileImage size={15} className="!text-indigo-500" />}
            onClick={() => setModalOpen(true)}
          >
            {showLabel ? displayLabel : null}
          </Button>
        </Tooltip>
        <Modal
          title={name}
          open={modalOpen}
          onCancel={() => setModalOpen(false)}
          footer={null}
          width={760}
          destroyOnClose
        >
          <Image
            src={fileUrl}
            alt={name}
            width="100%"
            style={{ maxHeight: "65vh", objectFit: "contain" }}
            preview
          />
        </Modal>
      </>
    );
  }

  if (isPdfAttachment(filePath)) {
    return (
      <>
        <Tooltip title={name}>
          <Button
            type="text"
            size="small"
            className="!rounded-lg hover:!bg-rose-50"
            icon={<FileText size={15} className="!text-rose-500" />}
            onClick={() => setModalOpen(true)}
          >
            {showLabel ? displayLabel : null}
          </Button>
        </Tooltip>
        <Modal
          title={name}
          open={modalOpen}
          onCancel={() => setModalOpen(false)}
          footer={null}
          width={520}
          destroyOnClose
        >
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <FileText size={44} className="text-rose-500" />
            <p className="mt-3 text-sm text-slate-600">PDF file available for viewing.</p>
            <a href={fileUrl} target="_blank" rel="noreferrer" className="mt-4">
              <Button type="primary" icon={<FileText size={14} />}>
                Open PDF
              </Button>
            </a>
          </div>
        </Modal>
      </>
    );
  }

  return (
    <>
      <Tooltip title={name}>
        <Button
          type="text"
          size="small"
          className="!rounded-lg hover:!bg-slate-100"
          icon={<Paperclip size={15} className="!text-slate-500" />}
          onClick={() => setModalOpen(true)}
        >
          {showLabel ? displayLabel : null}
        </Button>
      </Tooltip>
      <Modal
        title={name}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={520}
        destroyOnClose
      >
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <Paperclip size={40} className="text-slate-500" />
          <p className="mt-3 text-sm text-slate-600">Document is available to open in new page.</p>
          <a href={fileUrl} target="_blank" rel="noreferrer" className="mt-4">
            <Button type="primary" icon={<Paperclip size={14} />}>
              Open Document
            </Button>
          </a>
        </div>
      </Modal>
    </>
  );
}

export function AttachmentCell({
  filePath,
  baseUrl,
  emptyLabel = "None",
}: {
  filePath?: string | null;
  baseUrl: string;
  emptyLabel?: string;
}) {
  if (!filePath) return <span className="text-slate-400 text-xs">{emptyLabel}</span>;
  return <AttachmentIcon filePath={filePath} baseUrl={baseUrl} />;
}

export function AttachmentList({
  files,
  baseUrl,
  emptyLabel = "None",
  showLabels = false,
}: {
  files?: string[];
  baseUrl: string;
  emptyLabel?: string;
  showLabels?: boolean;
}) {
  if (!files?.length) return <span className="text-slate-400 text-xs">{emptyLabel}</span>;
  return (
    <Space size={4} wrap>
      {files.map((file, index) => (
        <AttachmentIcon
          key={`${file}-${index}`}
          filePath={file}
          baseUrl={baseUrl}
          showLabel={showLabels}
          label={`Doc ${index + 1}`}
        />
      ))}
    </Space>
  );
}
