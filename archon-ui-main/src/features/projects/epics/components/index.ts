/**
 * Epic Components Module
 *
 * Exports all Epic-related React components following the vertical slice pattern.
 * These components provide a complete UI for managing Epic entities in the TRAXIS hierarchy.
 */

// Core Epic Components
export { EpicCard } from "./EpicCard";
export { EpicList } from "./EpicList";
export { EpicView } from "./EpicView";
export { EpicModal } from "./EpicModal";

// Export component prop types for external usage
export type { EpicCardProps } from "./EpicCard";
export type { EpicListProps } from "./EpicList";
export type { EpicViewProps } from "./EpicView";
export type { EpicModalProps } from "./EpicModal";