import React from "react";

interface StoryModalProps {
  isOpen: boolean;
  epicId: string;
  editingStory?: any;
  onClose: () => void;
  onSaved: () => void;
}

export const StoryModal: React.FC<StoryModalProps> = ({
  isOpen,
  epicId,
  editingStory,
  onClose,
  onSaved,
}) => {
  // Temporary placeholder component
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-md w-full">
        <h2 className="text-lg font-semibold mb-4">
          {editingStory ? "Edit Story" : "Create Story"}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Story modal not implemented yet.
        </p>
        <button
          onClick={onClose}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Close
        </button>
      </div>
    </div>
  );
};