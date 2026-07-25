import { Upload, message as antdMessage } from "antd";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_UPLOAD_LABEL = "10 MB";

/**
 * antd `Upload` `beforeUpload` helper that:
 *  - rejects (and ignores) any file larger than MAX_UPLOAD_BYTES with a toast,
 *  - returns `false` for valid files so the caller handles upload manually.
 *
 * Use for every document/image upload in the app EXCEPT video management,
 * which intentionally allows much larger files.
 */
export const beforeUploadWithSizeLimit = (file: File): boolean | string => {
  if (file.size > MAX_UPLOAD_BYTES) {
    void antdMessage.error(`File size exceeds the ${MAX_UPLOAD_LABEL} limit. Please choose a smaller file.`);
    return Upload.LIST_IGNORE;
  }
  return false;
};
