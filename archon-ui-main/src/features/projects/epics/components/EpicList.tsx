import { Filter, Plus, Search, SortAsc, SortDesc } from "lucide-react";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Button } from "../../../ui/primitives/button";
import { Input } from "../../../ui/primitives/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../ui/primitives/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../ui/primitives/tooltip";
import { useCreateEpic, useProjectEpics, useUpdateEpicStatus } from "../hooks/useEpicQueries";
import type { Epic, EpicFilters, EpicSortOptions, HierarchyStatus, Priority } from "../types";
import { EPIC_PRIORITY_ORDER, EPIC_STATUS_ORDER } from "../utils/epic-styles";
import { EpicCard } from "./EpicCard";

export interface EpicListProps {
  projectId: string;
  onEpicEdit?: (epic: Epic) => void;
  onEpicDelete?: (epic: Epic) => void;
  onEpicViewStories?: (epic: Epic) => void;
  onCreateEpic?: () => void;
  showCreateButton?: boolean;
  showFilters?: boolean;
  showSorting?: boolean;
  className?: string;
}

export const EpicList: React.FC<EpicListProps> = ({
  projectId,
  onEpicEdit,
  onEpicDelete,
  onEpicViewStories,
  onCreateEpic,
  showCreateButton = true,
  showFilters = true,
  showSorting = true,
  className = "",
}) => {
  // Local state for filtering and sorting
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<EpicFilters>({});
  const [sortOptions, setSortOptions] = useState<EpicSortOptions>({
    field: "updated_at",
    direction: "desc",
  });
  const [hoveredEpicId, setHoveredEpicId] = useState<string | null>(null);
  const [selectedEpics, setSelectedEpics] = useState<Set<string>>(new Set());

  // React Query hooks
  const {
    data: epics = [],
    isLoading,
    error,
    refetch,
  } = useProjectEpics(projectId, {
    search: searchQuery,
    ...filters,
    sort: sortOptions,
  });

  const updateEpicStatus = useUpdateEpicStatus(projectId);

  // Memoized filtering and sorting
  const filteredAndSortedEpics = useMemo(() => {
    let result = [...epics];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (epic) => epic.title.toLowerCase().includes(query) || epic.description?.toLowerCase().includes(query) || false,
      );
    }

    // Apply status filter
    if (filters.status && filters.status.length > 0) {
      result = result.filter((epic) => filters.status!.includes(epic.status));
    }

    // Apply priority filter
    if (filters.priority && filters.priority.length > 0) {
      result = result.filter((epic) => filters.priority!.includes(epic.priority || "medium"));
    }

    // Apply MVP filter
    if (filters.mvp_only) {
      result = result.filter((epic) => epic.mvp_flag);
    }

    // Apply completion rate filters
    if (filters.completion_rate_min !== undefined) {
      result = result.filter((epic) => (epic.progress || 0) >= filters.completion_rate_min!);
    }
    if (filters.completion_rate_max !== undefined) {
      result = result.filter((epic) => (epic.progress || 0) <= filters.completion_rate_max!);
    }

    // Apply sorting
    result.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortOptions.field) {
        case "title":
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case "created_at":
          aValue = new Date(a.created_at);
          bValue = new Date(b.created_at);
          break;
        case "updated_at":
          aValue = new Date(a.updated_at);
          bValue = new Date(b.updated_at);
          break;
        case "priority":
          aValue = EPIC_PRIORITY_ORDER.indexOf(a.priority || "medium");
          bValue = EPIC_PRIORITY_ORDER.indexOf(b.priority || "medium");
          break;
        case "progress":
          aValue = a.progress || 0;
          bValue = b.progress || 0;
          break;
        case "status":
          aValue = EPIC_STATUS_ORDER.indexOf(a.status);
          bValue = EPIC_STATUS_ORDER.indexOf(b.status);
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOptions.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOptions.direction === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [epics, searchQuery, filters, sortOptions]);

  // Event handlers
  const handleEpicReorder = useCallback(
    (epicId: string, targetIndex: number, status: HierarchyStatus) => {
      // For now, just update the status if it changed
      const epic = epics.find((e) => e.id === epicId);
      if (epic && epic.status !== status) {
        updateEpicStatus.mutate({ epicId, status });
      }
    },
    [epics, updateEpicStatus],
  );

  const handleEpicSelect = useCallback((epicId: string) => {
    setSelectedEpics((prev) => {
      const newSelected = new Set(prev);
      if (newSelected.has(epicId)) {
        newSelected.delete(epicId);
      } else {
        newSelected.add(epicId);
      }
      return newSelected;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedEpics(new Set());
  }, []);

  const handleFilterChange = useCallback((key: keyof EpicFilters, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const handleSortChange = useCallback((field: EpicSortOptions["field"]) => {
    setSortOptions((prev) => ({
      field,
      direction: prev.field === field && prev.direction === "asc" ? "desc" : "asc",
    }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchQuery("");
    setFilters({});
    setSortOptions({ field: "updated_at", direction: "desc" });
  }, []);

  if (error) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="text-center text-red-600 dark:text-red-400">
          <p className="mb-4">Failed to load epics</p>
          <Button onClick={() => refetch()} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const hasActiveFilters =
    searchQuery.trim() ||
    (filters.status && filters.status.length > 0) ||
    (filters.priority && filters.priority.length > 0) ||
    filters.mvp_only ||
    filters.completion_rate_min !== undefined ||
    filters.completion_rate_max !== undefined;

  return (
    <TooltipProvider>
      <div className={`space-y-6 ${className}`}>
        {/* Header with actions */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Epics ({filteredAndSortedEpics.length})
            </h2>
            {selectedEpics.size > 0 && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {selectedEpics.size} epic{selectedEpics.size > 1 ? "s" : ""} selected
                <Button variant="ghost" size="sm" onClick={handleClearSelection} className="ml-2 text-xs h-6 px-2">
                  Clear
                </Button>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={handleClearFilters} className="text-xs">
                Clear Filters
              </Button>
            )}

            {showCreateButton && onCreateEpic && (
              <Button onClick={onCreateEpic} size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                New Epic
              </Button>
            )}
          </div>
        </div>

        {/* Filters and Search */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-4 p-4 bg-white/50 dark:bg-gray-800/50 rounded-lg backdrop-blur-sm border border-gray-200 dark:border-gray-700">
            {/* Search */}
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search epics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Status Filter */}
            <Select
              value={filters.status?.[0] || "all"}
              onValueChange={(value) =>
                handleFilterChange("status", value === "all" ? undefined : [value as HierarchyStatus])
              }
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {EPIC_STATUS_ORDER.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Priority Filter */}
            <Select
              value={filters.priority?.[0] || "all"}
              onValueChange={(value) =>
                handleFilterChange("priority", value === "all" ? undefined : [value as Priority])
              }
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                {EPIC_PRIORITY_ORDER.map((priority) => (
                  <SelectItem key={priority} value={priority}>
                    {priority.charAt(0).toUpperCase() + priority.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* MVP Filter */}
            <Button
              variant={filters.mvp_only ? "default" : "outline"}
              size="sm"
              onClick={() => handleFilterChange("mvp_only", !filters.mvp_only)}
              className="gap-2"
            >
              <Filter className="w-4 h-4" />
              MVP Only
            </Button>
          </div>
        )}

        {/* Sorting */}
        {showSorting && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span>Sort by:</span>
            {(["title", "created_at", "updated_at", "priority", "progress", "status"] as const).map((field) => (
              <Button
                key={field}
                variant="ghost"
                size="sm"
                onClick={() => handleSortChange(field)}
                className={`gap-1 text-xs h-7 px-2 ${
                  sortOptions.field === field ? "bg-gray-100 dark:bg-gray-700" : ""
                }`}
              >
                {field.replace("_", " ").charAt(0).toUpperCase() + field.replace("_", " ").slice(1)}
                {sortOptions.field === field &&
                  (sortOptions.direction === "asc" ? (
                    <SortAsc className="w-3 h-3" />
                  ) : (
                    <SortDesc className="w-3 h-3" />
                  ))}
              </Button>
            ))}
          </div>
        )}

        {/* Epic Cards */}
        <DndProvider backend={HTML5Backend}>
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-[180px] bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filteredAndSortedEpics.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredAndSortedEpics.map((epic, index) => (
                <EpicCard
                  key={epic.id}
                  epic={epic}
                  index={index}
                  projectId={projectId}
                  onEpicReorder={handleEpicReorder}
                  onEdit={onEpicEdit}
                  onDelete={onEpicDelete}
                  onViewStories={onEpicViewStories}
                  hoveredEpicId={hoveredEpicId}
                  onEpicHover={setHoveredEpicId}
                  selectedEpics={selectedEpics}
                  onEpicSelect={handleEpicSelect}
                  showProgress={true}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-500 dark:text-gray-400 mb-4">
                {hasActiveFilters ? "No epics match your filters" : "No epics yet"}
              </div>
              {showCreateButton && onCreateEpic && !hasActiveFilters && (
                <Button onClick={onCreateEpic} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Create Your First Epic
                </Button>
              )}
            </div>
          )}
        </DndProvider>
      </div>
    </TooltipProvider>
  );
};
