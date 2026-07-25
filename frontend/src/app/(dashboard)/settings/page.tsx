"use client";

import { useState } from "react";
import { Button, Input, Card } from "@/components/ui";

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSaving(false);
  };

  return (
    <div className="page-container">
      <div className="mb-6">
        <h1 className="page-title">Settings</h1>
        <p className="page-description">Manage your account settings</p>
      </div>

      <div className="max-w-2xl space-y-6">
        <Card title="Profile Information" description="Update your personal details">
          <form onSubmit={handleSave} className="space-y-4">
            <Input
              id="name"
              label="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
            />
            <Input
              id="email"
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
            />
            <Button type="submit" loading={saving}>
              Save Changes
            </Button>
          </form>
        </Card>

        <Card title="Change Password" description="Ensure your account is using a secure password">
          <form className="space-y-4">
            <Input id="current-password" label="Current Password" type="password" placeholder="Enter current password" />
            <Input id="new-password" label="New Password" type="password" placeholder="Enter new password" />
            <Input id="confirm-password" label="Confirm Password" type="password" placeholder="Confirm new password" />
            <Button type="submit">Update Password</Button>
          </form>
        </Card>

        <Card title="Danger Zone" description="Irreversible and destructive actions">
          <div className="flex items-center justify-between rounded-lg border border-red-200 p-4">
            <div>
              <p className="font-medium text-gray-900">Delete Account</p>
              <p className="text-sm text-gray-500">Permanently remove your account and all data</p>
            </div>
            <Button variant="danger">Delete Account</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
