import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
  action?: ReactNode;
}

export default function Card({ children, className, title, description, action }: CardProps) {
  return (
    <div className={cn("rounded-xl border border-gray-200 bg-white p-6 shadow-sm", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between">
          <div>
            {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
            {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
