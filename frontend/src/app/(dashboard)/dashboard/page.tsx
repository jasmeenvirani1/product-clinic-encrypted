"use client";

import { Users, Activity, TrendingUp, DollarSign } from "lucide-react";
import { Card } from "@/components/ui";

const stats = [
  { label: "Total Users", value: "2,340", icon: Users, change: "+12%", color: "bg-blue-500" },
  { label: "Active Sessions", value: "573", icon: Activity, change: "+5%", color: "bg-green-500" },
  { label: "Revenue", value: "$12,340.00", icon: DollarSign, change: "+18%", color: "bg-purple-500" },
  { label: "Growth", value: "23%", icon: TrendingUp, change: "+3%", color: "bg-orange-500" },
];

export default function DashboardPage() {
  return (
    <div className="page-container">
      <div className="mb-6">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-description">Welcome back! Here&apos;s an overview of your platform.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="mt-1 text-xs text-green-600">{stat.change} from last month</p>
              </div>
              <div className={`rounded-lg ${stat.color} p-3`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card title="Recent Activity">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-100 p-3">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <div className="flex-1">
                  <p className="text-sm text-gray-700">User action #{i} completed</p>
                  <p className="text-xs text-gray-400">{i} hour(s) ago</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Quick Actions">
          <div className="grid grid-cols-2 gap-3">
            {["Add User", "View Reports", "Settings", "Export Data"].map((action) => (
              <button
                key={action}
                className="rounded-lg border border-gray-200 p-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                {action}
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
