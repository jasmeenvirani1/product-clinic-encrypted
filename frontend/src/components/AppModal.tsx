"use client";

import { Modal } from "antd";
import type { ReactNode } from "react";

interface AppModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export const AppModal = ({ open, title, onClose, children }: AppModalProps) => (
  <Modal open={open} title={title} footer={null} onCancel={onClose} width={720}>
    {children}
  </Modal>
);
