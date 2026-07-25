"use client";

import { useState } from "react";
import { Alert, Button, Form, Input } from "antd";
import type { UploadFile } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProfilePhotoUploadField } from "@/components/ProfilePhotoUploadField";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { useAppSelector } from "@/hooks/useAppSelector";
import { registerThunk } from "@/store/slices/authSlice";

export default function RegisterPage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { status, error } = useAppSelector((state) => state.auth);
  const [profilePhotoFiles, setProfilePhotoFiles] = useState<UploadFile[]>([]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Create your workspace</h2>
        <p className="mt-1 text-sm text-slate-500">Set up your clinic account to get started.</p>
      </div>

      {error ? (
        <Alert
          type="error"
          showIcon
          message={error}
        />
      ) : null}

      <Form
        className="auth-form"
        layout="vertical"
        onFinish={async (values: { clinicName: string; name: string; email: string; password: string }) => {
          try {
            await dispatch(
              registerThunk({
                ...values,
                profile_photo: profilePhotoFiles[0]?.originFileObj as File | undefined,
              })
            ).unwrap();
            router.push("/verify-otp");
          } catch {
            // Error UI is rendered from auth slice state.
          }
        }}
      >
        <Form.Item label="Clinic name" name="clinicName" rules={[{ required: true }]}>
          <Input size="large" />
        </Form.Item>
        <ProfilePhotoUploadField
          files={profilePhotoFiles}
          setFiles={setProfilePhotoFiles}
          label="Profile Photo (optional)"
          description="Upload your profile image for your account. Max size 10 MB."
        />
        <Form.Item label="Full name" name="name" rules={[{ required: true }]}>
          <Input size="large" />
        </Form.Item>
        <Form.Item label="Email" name="email" rules={[{ required: true }]}>
          <Input size="large" />
        </Form.Item>
        <Form.Item label="Password" name="password" rules={[{ required: true }]}>
          <Input.Password size="large" />
        </Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          block
          size="large"
          loading={status === "loading"}
        >
          Create account
        </Button>
      </Form>
      <p className="text-center text-sm text-slate-500">
        Already have an account? <Link href="/login" className="auth-link">Login</Link>
      </p>
    </div>
  );
}
