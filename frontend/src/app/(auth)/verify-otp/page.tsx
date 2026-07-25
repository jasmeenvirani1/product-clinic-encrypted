"use client";

import { Alert, Button, Form, Input } from "antd";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { useAppSelector } from "@/hooks/useAppSelector";
import { verifyOtpThunk } from "@/store/slices/authSlice";

export default function OtpVerificationPage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { otpEmail, status } = useAppSelector((state) => state.auth);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-slate-900">Verify your email</h2>
        <p className="text-sm text-slate-500">Enter the 6-digit code sent to your inbox.</p>
      </div>

      {otpEmail ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <MailCheck size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-emerald-800">Code sent</p>
            <p className="truncate text-xs text-emerald-700">{otpEmail}</p>
          </div>
        </div>
      ) : null}

      <Form
        className="auth-form"
        layout="vertical"
        initialValues={{ otp: "" }}
        onFinish={async (values: { otp: string }) => {
          await dispatch(verifyOtpThunk({ otp: values.otp })).unwrap();
          router.push("/brand-setup");
        }}
      >
        <Form.Item
          label={<span className="text-sm font-semibold text-slate-800">Enter OTP</span>}
          name="otp"
          rules={[
            { required: true, message: "Please enter the OTP." },
            { len: 6, message: "The OTP must be 6 digits." },
          ]}
          className="otp-full-width"
        >
          <Input.OTP length={6} size="large" inputMode="numeric" />
        </Form.Item>

        <Button
          type="primary"
          htmlType="submit"
          block
          size="large"
          loading={status === "loading"}
          className="mt-2"
        >
          Verify Email
        </Button>
      </Form>

      <p className="text-center text-sm text-slate-500">
        Need a new code?{" "}
        <Link href="/register" className="auth-link">
          Resend OTP
        </Link>
      </p>
    </div>
  );
}
