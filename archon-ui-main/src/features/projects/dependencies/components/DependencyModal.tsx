/**
 * Dependency Modal Component
 *
 * Modal for creating, editing, and managing dependencies between entities
 * Provides validation, suggestions, and conflict detection
 */

import { AlertTriangle, Check, X, Lightbulb, Search, Plus, Trash2 } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../../ui/primitives/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../ui/primitives/dialog";
import { Input } from "../../../ui/primitives/input";
import { Label } from "../../../ui/primitives/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../ui/primitives/select";
import { Textarea } from "../../../ui/primitives/textarea";
import { Badge } from "../../../ui/primitives/badge";
import { Alert, AlertDescription } from "../../../ui/primitives/alert";
import { Separator } from "../../../ui/primitives/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../ui/primitives/tooltip";
import {
  useCreateDependency,
  useUpdateDependency,
  useDeleteDependency,
  useValidateDependency,
  useSuggestedDependencies,
} from "../hooks";
import type {
  Dependency,
  CreateDependencyRequest,
  UpdateDependencyRequest,
  DependencyEntityType,
  DependencyType,
  DependencyNode,
  DependencyValidation,
} from "../types";
import {
  getDependencyTypeLabel,
  getDependencyTypeColor,
  getEntityTypeLabel,
  getEntityTypeColor,
  validateDependency,
} from "../utils";

export interface DependencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  mode: "create" | "edit" | "view";

  // For editing existing dependency
  dependency?: Dependency;

  // For creating new dependency
  fromEntity?: DependencyNode;
  toEntity?: DependencyNode;

  // Available entities for selection
  availableEntities?: DependencyNode[];

  // Callbacks
  onDependencyCreated?: (dependency: Dependency) => void;
  onDependencyUpdated?: (dependency: Dependency) => void;
  onDependencyDeleted?: (dependencyId: string) => void;
}

export const DependencyModal: React.FC<DependencyModalProps> = ({
  isOpen,
  onClose,
  projectId,
  mode,
  dependency,
  fromEntity,
  toEntity,
  availableEntities = [],
  onDependencyCreated,
  onDependencyUpdated,
  onDependencyDeleted,
}) => {
  // Form state
  const [fromEntityId, setFromEntityId] = useState("");
  const [fromEntityType, setFromEntityType] = useState<DependencyEntityType>("epic");
  const [toEntityId, setToEntityId] = useState("");
  const [toEntityType, setToEntityType] = useState<DependencyEntityType>("epic");
  const [dependencyType, setDependencyType] = useState<DependencyType>("depends_on");
  const [description, setDescription] = useState("");
  const [searchFrom, setSearchFrom] = useState("");
  const [searchTo, setSearchTo] = useState("");

  // UI state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

  // Mutations
  const createDependencyMutation = useCreateDependency(projectId);
  const updateDependencyMutation = useUpdateDependency(projectId);
  const deleteDependencyMutation = useDeleteDependency(projectId);
  const validateDependencyMutation = useValidateDependency();

  // Suggestions (only for create mode)
  const suggestionsQuery = useSuggestedDependencies(
    fromEntityType,
    fromEntityId,
    10,
    { enabled: mode === "create" && !!fromEntityId && showSuggestions }
  );

  // Initialize form with props or existing dependency
  useEffect(() => {
    if (mode === "edit" && dependency) {
      setFromEntityId(dependency.from_id);
      setFromEntityType(dependency.from_type);
      setToEntityId(dependency.to_id);
      setToEntityType(dependency.to_type);
      setDependencyType(dependency.dependency_type);
      setDescription(dependency.description || "");
    } else if (mode === "create") {
      if (fromEntity) {
        setFromEntityId(fromEntity.id);
        setFromEntityType(fromEntity.type);
      }
      if (toEntity) {
        setToEntityId(toEntity.id);
        setToEntityType(toEntity.type);
      }
    }
  }, [mode, dependency, fromEntity, toEntity]);

  // Clear form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFromEntityId("");
      setToEntityId("");
      setDependencyType("depends_on");
      setDescription("");
      setSearchFrom("");
      setSearchTo("");
      setValidationErrors([]);
      setValidationWarnings([]);
      setShowSuggestions(false);
    }
  }, [isOpen]);

  // Filter entities based on search
  const filteredFromEntities = useMemo(() => {
    return availableEntities.filter(entity =>
      entity.title.toLowerCase().includes(searchFrom.toLowerCase()) ||
      entity.id.includes(searchFrom)
    );
  }, [availableEntities, searchFrom]);

  const filteredToEntities = useMemo(() => {
    return availableEntities.filter(entity =>
      entity.id !== fromEntityId && // Can't depend on self
      (entity.title.toLowerCase().includes(searchTo.toLowerCase()) ||
       entity.id.includes(searchTo))
    );
  }, [availableEntities, searchTo, fromEntityId]);

  // Get entity by ID
  const getEntityById = useCallback((id: string) => {
    return availableEntities.find(entity => entity.id === id);
  }, [availableEntities]);

  // Client-side validation
  const performValidation = useCallback(() => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!fromEntityId) errors.push("From entity is required");
    if (!toEntityId) errors.push("To entity is required");
    if (fromEntityId === toEntityId) errors.push("Cannot create dependency from entity to itself");

    if (fromEntityId && toEntityId) {
      const fromEntity = getEntityById(fromEntityId);
      const toEntity = getEntityById(toEntityId);

      if (fromEntity && toEntity) {
        const validation = validateDependency(fromEntity, toEntity, dependencyType);
        if (!validation.valid && validation.error) {
          errors.push(validation.error);
        }

        // Add warnings for questionable dependencies
        if (dependencyType === "blocks" && fromEntity.status === "done") {
          warnings.push("This entity is already completed, blocking relationship may not be meaningful");
        }

        if (dependencyType === "depends_on" && toEntity.status === "todo" && fromEntity.status === "done") {
          warnings.push("Depending on incomplete work when this is already done may indicate incorrect direction");
        }
      }
    }

    setValidationErrors(errors);
    setValidationWarnings(warnings);

    return errors.length === 0;
  }, [fromEntityId, toEntityId, dependencyType, getEntityById]);

  // Validate on changes
  useEffect(() => {
    if (fromEntityId && toEntityId) {
      performValidation();
    }
  }, [fromEntityId, toEntityId, dependencyType, performValidation]);

  // Server-side validation
  const performServerValidation = useCallback(async () => {
    if (!fromEntityId || !toEntityId) return false;

    try {
      const validation = await validateDependencyMutation.mutateAsync({
        from_type: fromEntityType,
        from_id: fromEntityId,
        to_type: toEntityType,
        to_id: toEntityId,
        dependency_type: dependencyType,
        description,
      });

      if (!validation.valid) {
        const errors = validation.conflicts?.map(c => c.message) || [];
        const warnings = validation.warnings || [];
        setValidationErrors(errors);
        setValidationWarnings(warnings);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Validation error:", error);
      setValidationErrors(["Failed to validate dependency"]);
      return false;
    }
  }, [
    fromEntityId,
    toEntityId,
    fromEntityType,
    toEntityType,
    dependencyType,
    description,
    validateDependencyMutation,
  ]);

  // Handle form submission
  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();

    // Client-side validation first
    if (!performValidation()) return;

    // Server-side validation
    const isValid = await performServerValidation();
    if (!isValid) return;

    try {
      if (mode === "create") {
        const newDependency = await createDependencyMutation.mutateAsync({
          from_type: fromEntityType,
          from_id: fromEntityId,
          to_type: toEntityType,
          to_id: toEntityId,
          dependency_type: dependencyType,
          description: description.trim() || undefined,
        });

        onDependencyCreated?.(newDependency);
      } else if (mode === "edit" && dependency) {
        const updatedDependency = await updateDependencyMutation.mutateAsync({
          dependencyId: dependency.id,
          updates: {
            dependency_type: dependencyType,
            description: description.trim() || undefined,
          },
        });

        onDependencyUpdated?.(updatedDependency);
      }

      onClose();
    } catch (error) {
      console.error("Failed to save dependency:", error);
    }
  }, [
    mode,
    dependency,
    fromEntityType,
    fromEntityId,
    toEntityType,
    toEntityId,
    dependencyType,
    description,
    performValidation,
    performServerValidation,
    createDependencyMutation,
    updateDependencyMutation,
    onDependencyCreated,
    onDependencyUpdated,
    onClose,
  ]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!dependency) return;

    if (!confirm("Are you sure you want to delete this dependency?")) return;

    try {
      await deleteDependencyMutation.mutateAsync(dependency.id);
      onDependencyDeleted?.(dependency.id);
      onClose();
    } catch (error) {
      console.error("Failed to delete dependency:", error);
    }
  }, [dependency, deleteDependencyMutation, onDependencyDeleted, onClose]);

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback((suggestion: any) => {
    setToEntityId(suggestion.target_id);
    setToEntityType(suggestion.target_type);
    setDependencyType(suggestion.suggested_type);
    setShowSuggestions(false);
  }, []);

  const isLoading = createDependencyMutation.isPending ||
                   updateDependencyMutation.isPending ||
                   deleteDependencyMutation.isPending;

  const canSubmit = fromEntityId && toEntityId && validationErrors.length === 0;

  return (
    <TooltipProvider>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {mode === "create" && "Create Dependency"}
              {mode === "edit" && "Edit Dependency"}
              {mode === "view" && "View Dependency"}
            </DialogTitle>
            <DialogDescription>
              {mode === "create" && "Create a new dependency relationship between entities"}
              {mode === "edit" && "Modify the dependency relationship"}
              {mode === "view" && "View dependency details"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* From Entity Selection */}
            <div className="space-y-2">
              <Label>From Entity</Label>
              <div className="flex gap-2">
                <Select
                  value={fromEntityType}
                  onValueChange={(value) => setFromEntityType(value as DependencyEntityType)}
                  disabled={mode !== "create"}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="epic">Epic</SelectItem>
                    <SelectItem value="story">Story</SelectItem>
                    <SelectItem value="task">Task</SelectItem>
                  </SelectContent>
                </Select>

                {mode === "create" ? (
                  <div className="flex-1 space-y-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
                      <Input
                        placeholder="Search entities..."
                        value={searchFrom}
                        onChange={(e) => setSearchFrom(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                    <Select value={fromEntityId} onValueChange={setFromEntityId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select from entity" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredFromEntities.map(entity => (
                          <SelectItem key={entity.id} value={entity.id}>
                            <div className="flex items-center gap-2">
                              <Badge
                                style={{
                                  backgroundColor: `${getEntityTypeColor(entity.type)}20`,
                                  color: getEntityTypeColor(entity.type),
                                }}
                              >
                                {getEntityTypeLabel(entity.type)}
                              </Badge>
                              <span className="truncate">{entity.title}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="flex-1">
                    <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border">
                      {getEntityById(fromEntityId)?.title || "Unknown Entity"}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Dependency Type */}
            <div className="space-y-2">
              <Label>Dependency Type</Label>
              <Select
                value={dependencyType}
                onValueChange={(value) => setDependencyType(value as DependencyType)}
                disabled={mode === "view"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blocks">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getDependencyTypeColor("blocks") }}
                      />
                      <span>Blocks</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="depends_on">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getDependencyTypeColor("depends_on") }}
                      />
                      <span>Depends On</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="related_to">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getDependencyTypeColor("related_to") }}
                      />
                      <span>Related To</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* To Entity Selection */}
            <div className="space-y-2">
              <Label>To Entity</Label>
              <div className="flex gap-2">
                <Select
                  value={toEntityType}
                  onValueChange={(value) => setToEntityType(value as DependencyEntityType)}
                  disabled={mode !== "create"}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="epic">Epic</SelectItem>
                    <SelectItem value="story">Story</SelectItem>
                    <SelectItem value="task">Task</SelectItem>
                  </SelectContent>
                </Select>

                {mode === "create" ? (
                  <div className="flex-1 space-y-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
                      <Input
                        placeholder="Search entities..."
                        value={searchTo}
                        onChange={(e) => setSearchTo(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Select value={toEntityId} onValueChange={setToEntityId}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select to entity" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredToEntities.map(entity => (
                            <SelectItem key={entity.id} value={entity.id}>
                              <div className="flex items-center gap-2">
                                <Badge
                                  style={{
                                    backgroundColor: `${getEntityTypeColor(entity.type)}20`,
                                    color: getEntityTypeColor(entity.type),
                                  }}
                                >
                                  {getEntityTypeLabel(entity.type)}
                                </Badge>
                                <span className="truncate">{entity.title}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowSuggestions(prev => !prev)}
                            disabled={!fromEntityId}
                          >
                            <Lightbulb className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Show Suggestions</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1">
                    <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border">
                      {getEntityById(toEntityId)?.title || "Unknown Entity"}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Suggestions */}
            {showSuggestions && suggestionsQuery.data && suggestionsQuery.data.length > 0 && (
              <div className="space-y-2">
                <Label>Suggestions</Label>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {suggestionsQuery.data.map((suggestion, index) => (
                    <div
                      key={index}
                      className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded border cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/40"
                      onClick={() => handleSuggestionSelect(suggestion)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{suggestion.target_title}</div>
                          <div className="text-sm text-gray-600">{suggestion.reason}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge>{getDependencyTypeLabel(suggestion.suggested_type)}</Badge>
                          <Badge variant="outline">{Math.round(suggestion.confidence * 100)}%</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Textarea
                placeholder="Additional notes about this dependency..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={mode === "view"}
                rows={3}
              />
            </div>

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1">
                    {validationErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Validation Warnings */}
            {validationWarnings.length > 0 && (
              <Alert>
                <Lightbulb className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1">
                    {validationWarnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </form>

          <DialogFooter className="flex justify-between">
            <div>
              {mode === "edit" && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isLoading}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>

              {mode !== "view" && (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit || isLoading}
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                  ) : mode === "create" ? (
                    <Plus className="w-4 h-4 mr-2" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  {mode === "create" ? "Create" : "Update"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
};