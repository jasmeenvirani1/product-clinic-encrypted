"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Button, Input, Card, Table } from "@/components/ui";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useFetch } from "@/hooks/useFetch";
import { useDebounce } from "@/hooks/useDebounce";
import { userService } from "@/services/user.service";
import { formatDate } from "@/lib/utils";
import type { User } from "@/types/user.types";

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search);

  const { data: users, loading } = useFetch(
    () => userService.getAll({ page, limit: 10, search: debouncedSearch }),
    [page, debouncedSearch]
  );

  const columns = [
    {
      key: "name",
      label: "Name",
      render: (user: User) => (
        <Link href={`/users/${user.id}`} className="font-medium text-primary-600 hover:underline">
          {user.name}
        </Link>
      ),
    },
    { key: "email", label: "Email" },
    {
      key: "role",
      label: "Role",
      render: (user: User) => (
        <span className="inline-flex rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700">
          {user.role}
        </span>
      ),
    },
    {
      key: "isActive",
      label: "Status",
      render: (user: User) => (
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
            user.isActive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {user.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "createdAt",
      label: "Created",
      render: (user: User) => formatDate(user.createdAt),
    },
  ];

  return (
    <div className="page-container">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-description">Manage your platform users</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Add User
        </Button>
      </div>

      <Card>
        <div className="mb-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {loading ? (
          <LoadingSpinner className="py-12" />
        ) : (
          <>
            <Table
              columns={columns}
              data={users || []}
              keyExtractor={(user) => user.id}
              emptyMessage="No users found"
            />
            <div className="mt-4 flex items-center justify-between">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-sm text-gray-500">Page {page}</span>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
