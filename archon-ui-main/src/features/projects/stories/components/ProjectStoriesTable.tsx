import { Edit } from "lucide-react";
import type { Story } from "../types";
import type { Epic } from "../../epics/types";
import { Badge } from "../../../ui/primitives/badge";
import { Button } from "../../../ui/primitives/button";
import { cn } from "../../../ui/primitives/styles";

const STATUS_COLORS: Record<string, string> = {
  todo: "bg-gray-100 text-gray-700 border-gray-200",
  doing: "bg-blue-100 text-blue-700 border-blue-200",
  review: "bg-amber-100 text-amber-700 border-amber-200",
  waiting: "bg-indigo-100 text-indigo-700 border-indigo-200",
  done: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

export interface ProjectStoriesTableProps {
  stories: Story[];
  epics: Epic[];
  onStoryEdit?: (story: Story) => void;
}

export const ProjectStoriesTable = ({ stories, epics, onStoryEdit }: ProjectStoriesTableProps) => {
  const epicLookup = epics.reduce<Record<string, Epic>>((acc, epic) => {
    acc[epic.id] = epic;
    return acc;
  }, {});

  if (stories.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        <p>No stories found for this project yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
        <thead className="bg-gray-50/70 dark:bg-gray-900/50">
          <tr>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
              Story
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
              Epic
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
              Status
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
              Priority
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
              Updated
            </th>
            {onStoryEdit && (
              <th scope="col" className="px-4 py-3" />
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white/60 dark:bg-gray-950/40">
          {stories.map((story) => {
            const epic = story.epic ?? epicLookup[story.epic_id];
            const statusClass = STATUS_COLORS[story.status] ?? STATUS_COLORS.todo;

            return (
              <tr key={story.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-900/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-900 dark:text-white">{story.title}</span>
                    {story.description && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                        {story.description}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {epic ? `${epic.code ? `${epic.code} · ` : ""}${epic.title}` : story.epic_id}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant="outline"
                    className={cn("text-xs font-medium px-2 py-1 border", statusClass)}
                  >
                    {story.status.toUpperCase()}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm capitalize text-gray-700 dark:text-gray-300">
                    {story.priority}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(story.updated_at).toLocaleString()}
                  </span>
                </td>
                {onStoryEdit && (
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onStoryEdit(story)}
                      className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
