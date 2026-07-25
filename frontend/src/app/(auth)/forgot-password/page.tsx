"use client";

import { Alert, Button, Form, Input } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { useAppSelector } from "@/hooks/useAppSelector";
import {
  sendForgotOtpThunk,
  verifyForgotOtpThunk,
  resetPasswordThunk,
} from "@/store/slices/authSlice";

type Step = "email" | "otp" | "reset";

export default function ForgotPasswordPage() {
  const dispatch = useAppDispatch();
  const router   = useRouter();
  const { status, error, otpEmail, resetToken } = useAppSelector((s) => s.auth);

  const [step, setStep]       = useState<Step>("email");
  const [email, setEmail]     = useState("");
  const [success, setSuccess] = useState(false);

  // ── Step 1: send OTP ─────────────────────────────────────────────────
  const handleSendOtp = async (values: { email: string }) => {
    const res = await dispatch(sendForgotOtpThunk(values.email));
    if (sendForgotOtpThunk.fulfilled.match(res)) {
      setEmail(values.email);
      setStep("otp");
    }
  };

  // ── Step 2: verify OTP ────────────────────────────────────────────────
  const handleVerifyOtp = async (values: { otp: string }) => {
    const res = await dispatch(verifyForgotOtpThunk({ email, otp: values.otp }));
    if (verifyForgotOtpThunk.fulfilled.match(res)) {
      setStep("reset");
    }
  };

  // ── Step 3: reset password ────────────────────────────────────────────
  const handleReset = async (values: { newPassword: string }) => {
    if (!resetToken) return;
    const res = await dispatch(resetPasswordThunk({ resetToken, newPassword: values.newPassword }));
    if (resetPasswordThunk.fulfilled.match(res)) {
      setSuccess(true);
      setTimeout(() => router.push("/login"), 1500);
    }
  };

  if (success) {
    return (
      <div className="space-y-4">
        <Alert
          type="success"
          message="Password reset successfully!"
          description="Redirecting you to login..."
          showIcon
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          {step === "email" && "Recover your access"}
          {step === "otp"   && "Verify your email"}
          {step === "reset" && "Set new password"}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {step === "email" && "Enter your email and we'll send you a one-time code."}
          {step === "otp"   && `Enter the 6-digit code sent to ${email}.`}
          {step === "reset" && "Choose a strong new password for your account."}
        </p>
      </div>

      {error && <Alert type="error" message={error} showIcon />}

      {/* ── Step 1: Email ── */}
      {step === "email" && (
        <Form layout="vertical" className="auth-form" onFinish={handleSendOtp}>
          <Form.Item
            label="Email address"
            name="email"
            rules={[{ required: true, type: "email", message: "Please enter a valid email." }]}
          >
            <Input size="large" placeholder="you@example.com" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={status === "loading"}>
            Send OTP
          </Button>
        </Form>
      )}

      {/* ── Step 2: OTP ── */}
      {step === "otp" && (
        <Form layout="vertical" className="auth-form" onFinish={handleVerifyOtp}>
          <Form.Item
            label="One-time code"
            name="otp"
            rules={[{ required: true, len: 6, message: "Please enter the 6-digit code." }]}
          >
            <Input size="large" maxLength={6} placeholder="······" className="tracking-widest text-center text-lg" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={status === "loading"}>
            Verify OTP
          </Button>
          <button
            type="button"
            className="mt-2 w-full text-sm text-slate-500 hover:text-slate-700"
            onClick={() => setStep("email")}
          >
            ← Change email
          </button>
        </Form>
      )}

      {/* ── Step 3: New password ── */}
      {step === "reset" && (
        <Form layout="vertical" className="auth-form" onFinish={handleReset}>
          <Form.Item
            label="New password"
            name="newPassword"
            rules={[{ required: true, min: 6, message: "Password must be at least 6 characters." }]}
          >
            <Input.Password size="large" placeholder="Enter new password" />
          </Form.Item>
          <Form.Item
            label="Confirm new password"
            name="confirmPassword"
            dependencies={["newPassword"]}
            rules={[
              { required: true, message: "Please confirm your password." },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("newPassword") === value) return Promise.resolve();
                  return Promise.reject(new Error("Passwords do not match."));
                },
              }),
            ]}
          >
            <Input.Password size="large" placeholder="Re-type new password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={status === "loading"}>
            Save new password
          </Button>
        </Form>
      )}

      <p className="text-sm text-slate-500">
        Back to <Link href="/login" className="auth-link">login</Link>
      </p>
    </div>
  );
}
