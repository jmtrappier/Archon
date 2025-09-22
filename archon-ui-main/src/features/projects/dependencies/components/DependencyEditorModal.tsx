/**
 * DependencyEditorModal - Modal for creating and managing dependencies
 *
 * Provides search, validation, and creation of dependencies between hierarchy nodes.
 */

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  ArrowLeft,
  ArrowRight,
  Link,
  Search,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useCreateDependency,
  useDependencySuggestions
} from '../hooks/useHierarchyDependencies';
import type {
  DependencyEntityType,
  DependencyType,
  CreateDependencyRequest
} from '../types/dependency';
import type { HierarchyTreeNode } from '../../shared/types/hierarchy';

const dependencySchema = z.object({
  to_type: z.enum(['epic', 'story', 'task']),
  to_id: z.string().min(1, 'Target is required'),
  dependency_type: z.enum(['blocks', 'depends_on', 'related_to']),
  description: z.string().optional(),
});

type DependencyFormData = z.infer<typeof dependencySchema>;

export interface DependencyEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceNode: HierarchyTreeNode;
  availableNodes: HierarchyTreeNode[]; // All nodes that can be targets
}

const dependencyTypeLabels: Record<DependencyType, string> = {
  blocks: 'Blocks',
  depends_on: 'Depends on',
  related_to: 'Related to'
};

const dependencyTypeIcons: Record<DependencyType, React.ReactNode> = {
  blocks: <ArrowLeft className="h-3 w-3" />,
  depends_on: <ArrowRight className="h-3 w-3" />,
  related_to: <Link className="h-3 w-3" />
};

const dependencyTypeDescriptions: Record<DependencyType, string> = {
  blocks: 'This item prevents the target from progressing',
  depends_on: 'This item cannot start until the target is completed',
  related_to: 'This item is related to the target but not blocking'
};

const entityTypeLabels: Record<DependencyEntityType, string> = {
  epic: 'Epic',
  story: 'Story',
  task: 'Task'
};

function TargetNodeItem({
  node,
  onSelect,
  isSelected
}: {
  node: HierarchyTreeNode;
  onSelect: () => void;
  isSelected: boolean;
}) {
  return (
    <CommandItem
      onSelect={onSelect}
      className={cn(
        "flex items-center justify-between gap-2 cursor-pointer",
        isSelected && "bg-blue-50 dark:bg-blue-950"
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Badge variant="outline" className="text-xs flex-shrink-0">
          {entityTypeLabels[node.type as DependencyEntityType]}
        </Badge>
        <span className="text-sm truncate">{node.title}</span>
      </div>
      {isSelected && (
        <CheckCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />
      )}
    </CommandItem>
  );
}

function SuggestionItem({
  suggestion,
  onSelect
}: {
  suggestion: {
    target_type: DependencyEntityType;
    target_id: string;
    target_title: string;
    suggested_type: DependencyType;
    confidence: number;
    reason: string;
  };
  onSelect: () => void;
}) {
  return (
    <div
      className="flex items-center justify-between gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-100/50 cursor-pointer dark:border-slate-700 dark:bg-slate-800/50 dark:hover:bg-slate-700/50"
      onClick={onSelect}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="flex items-center gap-1">
          {dependencyTypeIcons[suggestion.suggested_type]}
          <Badge variant="outline" className="text-xs">
            {entityTypeLabels[suggestion.target_type]}
          </Badge>
        </div>
        <span className="text-sm truncate">{suggestion.target_title}</span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Badge
          variant={suggestion.confidence > 0.7 ? "default" : "secondary"}
          className="text-xs"
        >
          {Math.round(suggestion.confidence * 100)}%
        </Badge>
      </div>
    </div>
  );
}

export function DependencyEditorModal({
  isOpen,
  onClose,
  sourceNode,
  availableNodes
}: DependencyEditorModalProps) {
  const [targetSearchOpen, setTargetSearchOpen] = React.useState(false);
  const [showSuggestions, setShowSuggestions] = React.useState(false);

  const sourceEntityType = sourceNode.type as DependencyEntityType;
  const sourceEntityId = sourceNode.id;

  const form = useForm<DependencyFormData>({
    resolver: zodResolver(dependencySchema),
    defaultValues: {
      dependency_type: 'depends_on',
      description: '',
    },
  });

  const { data: suggestions, isLoading: loadingSuggestions } = useDependencySuggestions(
    sourceEntityType,
    sourceEntityId,
    showSuggestions && isOpen
  );

  const createMutation = useCreateDependency();

  // Filter out the source node and nodes that would create invalid dependencies
  const validTargetNodes = React.useMemo(() => {
    return availableNodes.filter(node =>
      node.nodeId !== sourceNode.nodeId &&
      node.type !== 'project' &&
      ['epic', 'story', 'task'].includes(node.type)
    );
  }, [availableNodes, sourceNode.nodeId]);

  const selectedTargetId = form.watch('to_id');
  const selectedTargetNode = validTargetNodes.find(node => node.id === selectedTargetId);

  const onSubmit = async (data: DependencyFormData) => {
    try {
      const request: CreateDependencyRequest = {
        from_type: sourceEntityType,
        from_id: sourceEntityId,
        to_type: data.to_type,
        to_id: data.to_id,
        dependency_type: data.dependency_type,
        description: data.description || undefined,
      };

      await createMutation.mutateAsync(request);
      onClose();
      form.reset();
    } catch (error) {
      // Error handling is done in the mutation
    }
  };

  const handleSuggestionSelect = (suggestion: NonNullable<typeof suggestions>[0]) => {
    if (!suggestion) return;

    form.setValue('to_type', suggestion.target_type);
    form.setValue('to_id', suggestion.target_id);
    form.setValue('dependency_type', suggestion.suggested_type);
    setShowSuggestions(false);
  };

  React.useEffect(() => {
    if (isOpen) {
      setShowSuggestions(true);
    } else {
      form.reset();
      setShowSuggestions(false);
    }
  }, [isOpen, form]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Dependency</DialogTitle>
          <DialogDescription>
            Create a dependency relationship from{' '}
            <Badge variant="outline" className="mx-1">
              {entityTypeLabels[sourceEntityType]}
            </Badge>
            <span className="font-medium">{sourceNode.title}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Suggestions Section */}
              {suggestions && suggestions.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">Suggestions</span>
                  </div>
                  <ScrollArea className="h-32">
                    <div className="space-y-2 pr-4">
                      {suggestions.slice(0, 5).map((suggestion, index) => (
                        <SuggestionItem
                          key={`${suggestion.target_type}-${suggestion.target_id}`}
                          suggestion={suggestion}
                          onSelect={() => handleSuggestionSelect(suggestion)}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                  <Separator />
                </div>
              )}

              {/* Target Selection */}
              <FormField
                control={form.control}
                name="to_id"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Target</FormLabel>
                    <Popover open={targetSearchOpen} onOpenChange={setTargetSearchOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={targetSearchOpen}
                            className={cn(
                              "justify-between",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {selectedTargetNode ? (
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {entityTypeLabels[selectedTargetNode.type as DependencyEntityType]}
                                </Badge>
                                {selectedTargetNode.title}
                              </div>
                            ) : (
                              <span>Select target...</span>
                            )}
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-96 p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search nodes..." />
                          <CommandEmpty>No nodes found.</CommandEmpty>
                          <CommandList>
                            <CommandGroup>
                              {validTargetNodes.map((node) => (
                                <TargetNodeItem
                                  key={node.nodeId}
                                  node={node}
                                  isSelected={field.value === node.id}
                                  onSelect={() => {
                                    form.setValue('to_type', node.type as DependencyEntityType);
                                    form.setValue('to_id', node.id);
                                    setTargetSearchOpen(false);
                                  }}
                                />
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Dependency Type */}
              <FormField
                control={form.control}
                name="dependency_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Relationship Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select relationship type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(Object.keys(dependencyTypeLabels) as DependencyType[]).map((type) => (
                          <SelectItem key={type} value={type}>
                            <div className="flex items-center gap-2">
                              {dependencyTypeIcons[type]}
                              <div>
                                <div className="font-medium">{dependencyTypeLabels[type]}</div>
                                <div className="text-xs text-muted-foreground">
                                  {dependencyTypeDescriptions[type]}
                                </div>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add additional context about this dependency..."
                        className="min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={createMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || !form.watch('to_id')}
                >
                  {createMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create Dependency
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DependencyEditorModal;