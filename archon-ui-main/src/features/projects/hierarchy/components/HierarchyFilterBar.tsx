import { Filter, Eye, EyeOff } from "lucide-react";
import { Button } from "@/features/ui/primitives";
import { Badge } from "@/features/ui/primitives/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/features/ui/primitives/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/features/ui/primitives/toggle-group";
import { Input } from "@/features/ui/primitives/input";
import { Checkbox } from "@/features/ui/primitives/checkbox";
import type { HierarchyFiltersMetadata } from "../hooks/useHierarchyData";
import type { HierarchyFiltersResult } from "../hooks/useHierarchyFilters";
import type { HierarchyStatus, Priority } from "../../shared/types";

const STATUS_LABELS: Record<HierarchyStatus, string> = {
  todo: "Todo",
  doing: "Doing",
  review: "Review",
  waiting: "Waiting",
  done: "Done",
};

const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

interface HierarchyFilterBarProps {
  metadata?: HierarchyFiltersMetadata;
  filterHelpers: HierarchyFiltersResult;
}

export const HierarchyFilterBar: React.FC<HierarchyFilterBarProps> = ({ metadata, filterHelpers }) => {
  const {
    filters,
    setSearch,
    toggleStatus,
    togglePriority,
    toggleAssignee,
    toggleMvpOnly,
    setVisibilityMode,
    setViewMode,
    setIncludeArchived,
  } = filterHelpers;

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200/60 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/60">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Hierarchy Filters</span>
        </div>

        <div className="flex items-center gap-2">
          <ToggleGroup type="single" value={filters.viewMode} onValueChange={(value) => value && setViewMode(value as typeof filters.viewMode)}>
            <ToggleGroupItem value="hierarchy" className="text-xs">Hierarchy</ToggleGroupItem>
            <ToggleGroupItem value="dependencies" className="text-xs">Dependencies</ToggleGroupItem>
          </ToggleGroup>
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Checkbox
            id="include-archived"
            checked={filters.includeArchived}
            onCheckedChange={(checked) => setIncludeArchived(Boolean(checked))}
          />
          Include archived
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[220px] flex-1 items-center gap-2">
          <Input
            value={filters.search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title or path..."
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          {filters.visibilityMode === "hide" ? (
            <EyeOff className="h-3.5 w-3.5" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
          <span>{filters.visibilityMode === "hide" ? "Hide non-matching" : "Dim non-matching"}</span>
          <Button
            variant="ghost"
            size="xs"
            className="text-xs"
            onClick={() => setVisibilityMode(filters.visibilityMode === "hide" ? "dim" : "hide")}
          >
            Toggle
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-400">Status</span>
          {(Object.keys(STATUS_LABELS) as HierarchyStatus[]).map((status) => {
            const isActive = filters.statuses.includes(status);
            const count = metadata?.statuses[status] ?? 0;
            return (
              <Button
                key={status}
                variant={isActive ? "default" : "outline"}
                size="xs"
                onClick={() => toggleStatus(status)}
                className="text-xs capitalize"
              >
                {STATUS_LABELS[status]} {count > 0 && <Badge className="ml-2 bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{count}</Badge>}
              </Button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-400">Priority</span>
          {(Object.keys(PRIORITY_LABELS) as Priority[]).map((priority) => {
            const isActive = filters.priorities.includes(priority);
            const count = metadata?.priorities[priority] ?? 0;
            return (
              <Button
                key={priority}
                variant={isActive ? "default" : "outline"}
                size="xs"
                onClick={() => togglePriority(priority)}
                className="text-xs capitalize"
              >
                {PRIORITY_LABELS[priority]} {count > 0 && <Badge className="ml-2 bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{count}</Badge>}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="xs">
                Assignees
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-52" align="start">
              <DropdownMenuLabel>Filter by assignee</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {metadata && Object.keys(metadata.assignees).length === 0 && (
                <div className="px-2 py-1.5 text-xs text-slate-400">No assignees available</div>
              )}
              {metadata &&
                Object.entries(metadata.assignees).map(([assignee, count]) => (
                  <DropdownMenuCheckboxItem
                    key={assignee}
                    checked={filters.assignees.includes(assignee)}
                    onCheckedChange={() => toggleAssignee(assignee)}
                  >
                    <span className="flex-1 truncate">{assignee}</span>
                    <Badge className="ml-2 bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{count}</Badge>
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant={filters.mvpOnly ? "default" : "outline"}
            size="xs"
            disabled={!metadata?.hasMvp}
            onClick={toggleMvpOnly}
          >
            MVP Only
          </Button>
        </div>

        {filters.assignees.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {filters.assignees.map((assignee) => (
              <Badge key={assignee} className="bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {assignee}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
