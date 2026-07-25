import { Switch } from "antd";
import type { SwitchProps } from "antd";
import { cn } from "@/lib/utils";

export function AppSwitch({ className, ...props }: SwitchProps) {
  return <Switch {...props} className={cn("crm-app-switch", className)} />;
}

