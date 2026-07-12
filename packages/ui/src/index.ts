/**
 * =============================================================================
 * @leadforge/ui — Shared UI component library
 * =============================================================================
 *
 * Phase 1: the dashboard (this repo's src/components/) is the canonical
 * implementation. In Phase 2, these components are extracted into this
 * package so they can be shared between:
 *  - The dashboard app
 *  - A future admin console
 *  - Storybook
 *  - Marketing site
 *
 * Re-export path remains stable so consumers don't need to change imports
 * when the extraction happens.
 * =============================================================================
 */

export {
  // Layout
  AppShell,
} from "../../../src/components/layout/app-shell";

export {
  // Common
  PageHeader,
} from "../../../src/components/common/page-header";

export {
  StatCard,
} from "../../../src/components/common/stat-card";

export {
  DataTable,
  selectionColumn,
} from "../../../src/components/data-table/data-table";
