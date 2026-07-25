"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Mail, Shield, Calendar } from "lucide-react";
import { Button, Card } from "@/components/ui";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useFetch } from "@/hooks/useFetch";
import { userService } from "@/services/user.service";
import { formatDateTime, getInitials } from "@/lib/utils";

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: user, loading } = useFetch(() => userService.getById(id), [id]);

  if (loading) return <LoadingSpinner className="min-h-[400px]" size="lg" />;

  if (!user) {
    return (
      <div className="page-container text-center">
        <p className="text-gray-500">User not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Button variant="ghost" className="mb-4" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Users
      </Button>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-600 text-2xl font-bold text-white">
              {getInitials(user.name)}
            </div>
            <h2 className="mt-4 text-xl font-semibold text-gray-900">{user.name}</h2>
            <span
              className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                user.isActive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}
            >
              {user.isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </Card>

        <Card title="User Details" className="lg:col-span-2">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium text-gray-900">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Role</p>
                <p className="font-medium capitalize text-gray-900">{user.role}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Created</p>
                <p className="font-medium text-gray-900">{formatDateTime(user.createdAt)}</p>
              </div>
            </div>
            {user.lastLogin && (
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Last Login</p>
                  <p className="font-medium text-gray-900">{formatDateTime(user.lastLogin)}</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            <Button variant="outline">Edit User</Button>
            <Button variant="danger">Delete User</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
