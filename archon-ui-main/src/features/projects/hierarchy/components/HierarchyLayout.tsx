import React, { ReactNode } from "react";
import { ChevronLeft, Plus } from "lucide-react";
import { Button } from "@/features/ui/primitives";
import { HierarchyBreadcrumb } from "@/features/ui/components/navigation";

interface HierarchyLayoutProps {
  level: "project" | "epic" | "story" | "task";
  title: string;
  subtitle?: string;
  progress?: number;
  breadcrumb?: ReactNode;
  onBack?: () => void;
  onAddNew?: () => void;
  addNewLabel?: string;
  children: ReactNode;
  stats?: {
    label: string;
    value: number;
  }[];
}

export const HierarchyLayout: React.FC<HierarchyLayoutProps> = ({
  level,
  title,
  subtitle,
  progress,
  breadcrumb,
  onBack,
  onAddNew,
  addNewLabel,
  children,
  stats,
}) => {
  const getLevelColor = () => {
    switch (level) {
      case "epic":
        return "text-purple-600 dark:text-purple-400";
      case "story":
        return "text-blue-600 dark:text-blue-400";
      case "task":
        return "text-green-600 dark:text-green-400";
      default:
        return "text-gray-900 dark:text-white";
    }
  };

  const getProgressColor = () => {
    if (!progress) return "bg-gray-200 dark:bg-gray-700";
    if (progress >= 80) return "bg-green-500";
    if (progress >= 50) return "bg-blue-500";
    if (progress >= 25) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        {/* Breadcrumb */}
        {breadcrumb && (
          <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
            {breadcrumb}
          </div>
        )}

        {/* Title and Stats */}
        <div className="px-4 py-4 sm:px-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                {onBack && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onBack}
                    className="p-2"
                    aria-label="Go back"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                )}
                <div>
                  <h1 className={`text-2xl font-bold ${getLevelColor()}`}>
                    {title}
                  </h1>
                  {subtitle && (
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>

              {/* Stats Bar */}
              {stats && stats.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-4">
                  {stats.map((stat, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {stat.label}:
                      </span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {stat.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Progress Bar */}
              {progress !== undefined && (
                <div className="mt-4 max-w-md">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Progress
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {Math.round(progress)}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getProgressColor()} transition-all duration-500 ease-out`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Add New Button */}
            {onAddNew && (
              <Button
                onClick={onAddNew}
                size="sm"
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {addNewLabel || "Add New"}
                </span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6 sm:px-6">
        {children}
      </div>
    </div>
  );
};