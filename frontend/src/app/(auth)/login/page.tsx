"use client";

import { Alert, Button, Form, Input } from "antd";
import Link from "next/link";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { useAppSelector } from "@/hooks/useAppSelector";
import { loginThunk } from "@/store/slices/authSlice";

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const { status, error } = useAppSelector((state) => state.auth);

  const handleLogin = async (values: { email: string; password: string }) => {
    const result = await dispatch(loginThunk(values));
    if (loginThunk.fulfilled.match(result)) {
      // Hard redirect so the browser sends a fresh HTTP request with the
      // just-set cookie. router.push (soft nav) can serve a stale prefetch
      // response that the middleware cached before authentication, causing
      // a blank page that only goes away after a manual refresh.
      window.location.href = result.payload.redirectTo;
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
        <p className="mt-1 text-sm text-slate-500">
          Sign in to your CRM workspace. Role-based redirect applies automatically.
        </p>
      </div>

      {error ? <Alert type="error" message={error} showIcon /> : null}

      <Form
        className="crm-form"
        layout="vertical"
        initialValues={{ email: "", password: "" }}
        onFinish={(values: { email: string; password: string }) => void handleLogin(values)}
      >
        <Form.Item label="Email address" name="email" rules={[{ required: true }]}>
          <Input size="large" placeholder="you@example.com" />
        </Form.Item>
        <Form.Item label="Password" name="password" rules={[{ required: true }]}>
          <Input.Password size="large" placeholder="••••••••" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block size="large" loading={status === "loading"}>
          Sign In
        </Button>
      </Form>

      <div className="flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="auth-link">Forgot password?</Link>
        <Link href="/register" className="auth-link">Create account</Link>
      </div>

      {/* <Divider plain className="!text-xs !text-slate-400">Demo credentials</Divider> */}

      {/* <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 space-y-1.5">
        <p className="font-semibold text-slate-700 mb-2">Demo credentials (password: Admin@123)</p>
        <div className="flex items-center justify-between">
          <span>super@medleads.ai</span>
          <span className="rounded bg-violet-100 px-1.5 py-0.5 text-violet-600 font-medium">Super Admin</span>
        </div>
        <div className="flex items-center justify-between">
          <span>owner@novaclinic.ai</span>
          <span className="rounded bg-teal-100 px-1.5 py-0.5 text-teal-600 font-medium">Tenant Admin</span>
        </div>
        <div className="flex items-center justify-between">
          <span>staff@novaclinic.ai</span>
          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-600 font-medium">Staff</span>
        </div>
      </div> */}
    </div>
  );
}
