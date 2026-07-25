"use client";

import { Button, Result } from "antd";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <Result
        status="404"
        title="Page not found"
        subTitle="The CRM route you requested does not exist."
        extra={
          <Button type="primary">
            <Link href="/login">Back to login</Link>
          </Button>
        }
      />
    </div>
  );
}
