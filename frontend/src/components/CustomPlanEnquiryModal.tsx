"use client";

import { useState } from "react";
import { App, Button, Form, Input, Modal } from "antd";
import { Send } from "lucide-react";
import { customPlanEnquiryService } from "@/services/custom-plan-enquiry.service";

interface CustomPlanEnquiryModalProps {
  open: boolean;
  onClose: () => void;
}

// Client-side validation mirrors the server exactly — kept in sync with
// backend/controllers/customPlanEnquiryController.js. Do not change one side
// without the other.
const NAME_MAX = 100;
const MOBILE_MAX = 20;
const EMAIL_MAX = 150;
const MESSAGE_MAX = 2000;
const MOBILE_REGEX = /^[+]?[0-9][0-9\s\-()]{5,19}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface CustomPlanEnquiryFormValues {
  name: string;
  mobile: string;
  email: string;
  message?: string;
}

const GENERIC_ERROR_MESSAGE = "Unable to submit enquiry right now. Please try again later.";
const RATE_LIMIT_MESSAGE = "Too many requests. Please try again in a few minutes.";

export const CustomPlanEnquiryModal = ({ open, onClose }: CustomPlanEnquiryModalProps) => {
  const { message } = App.useApp();
  const [form] = Form.useForm<CustomPlanEnquiryFormValues>();
  const [submitting, setSubmitting] = useState(false);

  // Distinct from the `onClose` prop: this is the Modal's own dismiss handler
  // (mask click / X button / Esc) and must be a no-op while a submit is in
  // flight so the user cannot lose the outcome of their request.
  const handleCancel = () => {
    if (submitting) return;
    onClose();
  };

  const handleSubmit = async (values: CustomPlanEnquiryFormValues) => {
    setSubmitting(true);
    try {
      const res = await customPlanEnquiryService.submit({
        name: values.name.trim(),
        mobile: values.mobile.trim(),
        email: values.email.trim(),
        // Optional — omit entirely when blank so the email body can skip the row.
        message: values.message?.trim() || undefined,
      });
      void message.success(res.message || "Enquiry submitted. Our team will reach out shortly.");
      form.resetFields();
      onClose();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const serverMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;

      if (status === 429) {
        void message.error(serverMessage || RATE_LIMIT_MESSAGE);
      } else if (status === 400 && serverMessage) {
        void message.error(serverMessage);
      } else if (serverMessage) {
        void message.error(serverMessage);
      } else {
        void message.error(GENERIC_ERROR_MESSAGE);
      }
      // Keep the modal open on failure so the user sees the error and can
      // retry without re-entering their details.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Talk to Sales"
      footer={null}
      onCancel={handleCancel}
      closable={!submitting}
      maskClosable={!submitting}
      destroyOnClose
    >
      <p className="text-sm text-slate-500 mb-4">
        Tell us a bit about your clinic and we&apos;ll get back to you with a plan tailored to your needs.
      </p>
      <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
        <Form.Item
          name="name"
          label="Name"
          rules={[
            { required: true, whitespace: true, message: "Name is required" },
            { max: NAME_MAX, message: `Name must be at most ${NAME_MAX} characters` },
          ]}
        >
          <Input placeholder="Your full name" disabled={submitting} maxLength={NAME_MAX} />
        </Form.Item>

        <Form.Item
          name="mobile"
          label="Mobile Number"
          rules={[
            { required: true, whitespace: true, message: "Mobile number is required" },
            { max: MOBILE_MAX, message: `Mobile number must be at most ${MOBILE_MAX} characters` },
            { pattern: MOBILE_REGEX, message: "Enter a valid mobile number" },
          ]}
        >
          <Input placeholder="+1 415-555-0132" disabled={submitting} maxLength={MOBILE_MAX} />
        </Form.Item>

        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, whitespace: true, message: "Email is required" },
            { max: EMAIL_MAX, message: `Email must be at most ${EMAIL_MAX} characters` },
            { pattern: EMAIL_REGEX, message: "Enter a valid email address" },
          ]}
        >
          <Input placeholder="you@clinic.com" disabled={submitting} maxLength={EMAIL_MAX} />
        </Form.Item>

        {/* Optional on purpose: requiring free text on a sales enquiry costs leads,
            and sales can follow up using the contact details above. The form sets
            requiredMark={false} so AntD draws no asterisks anywhere — nothing would
            otherwise distinguish this field from the three required ones, hence the
            "(optional)" hint lives in the label text itself. */}
        <Form.Item
          name="message"
          label={
            <span>
              Tell us about your requirement{" "}
              <span className="text-slate-400 font-normal">(optional)</span>
            </span>
          }
          rules={[{ max: MESSAGE_MAX, message: `Please keep this under ${MESSAGE_MAX} characters` }]}
        >
          <Input.TextArea
            rows={4}
            placeholder="Briefly describe what you need — number of locations, integrations, expected patient volume, anything specific to your clinic."
            disabled={submitting}
            maxLength={MESSAGE_MAX}
            showCount
          />
        </Form.Item>

        <Form.Item className="mb-0 mt-2">
          <Button
            type="primary"
            htmlType="submit"
            block
            loading={submitting}
            icon={<Send size={14} />}
          >
            Submit Enquiry
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
};
