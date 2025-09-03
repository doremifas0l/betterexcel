understand my app.


---

## Comprehensive Documentation: Application Architecture & File Roles

This document provides a detailed overview of the Better Excel application's source code, outlining the purpose of each key directory and file within the project.

### High-Level Architectural Overview

The application is a modern, full-stack system built with React and TypeScript, composed of three distinct layers:

1.  **Frontend (`/src`)**: The browser-based code responsible for all user interactions, UI, and application state management.
2.  **Backend (`/supabase/functions`)**: A suite of secure, server-side Deno Edge Functions that execute complex business logic and sensitive database operations.
3.  **Database (Supabase)**: A cloud-hosted PostgreSQL database that serves as the single source of truth for all application data, enhanced with its own rules, security policies, and automated triggers.

---

### Part 1: The Frontend (`/src` Directory)

This is the core of the user-facing application.

#### 📁 Root Files & Core Configuration

*   `main.tsx`: The absolute entry point of the application. Its sole job is to start the React rendering process and mount the main `App` component.
*   `App.tsx`: The top-level React component. It sets up the main application router and renders the primary layouts, determining which page is visible based on the URL.
*   `lib/supabase.ts`: A crucial configuration file that initializes and exports the global Supabase client instance, making it available for database communication.
*   `lib/formatting.ts` & `lib/utils.ts`: Utility libraries containing shared helper functions (e.g., for formatting dates, numbers, or other common tasks) used across multiple components.
*   `styles/`: A directory containing global and component-specific CSS files that define the application's visual appearance.
*   `utils/enable-auth-bypass.js`: A specialized development script used to create a fake user session during local development, allowing developers to bypass the login screen for faster debugging.

#### 📁 `src/context/` - Global State Management

This folder holds the "global memory" or shared state of the application, making key information accessible everywhere.

*   `AuthContext.tsx`: The application's identity and security manager. It manages the user's login status, holds the current `user` object and a `loading` state, and provides the core `signIn`, `signUp`, and `signOut` functions.
*   `FormattingContext.tsx`: The application's style guide for data display. It manages user preferences for how data like dates, numbers, and currencies are formatted, ensuring consistency across all components.
*   `FullscreenContext.tsx`: A UI state manager that provides a "focus mode," allowing components like a data table to expand to fill the entire screen and reduce distractions.

#### 📁 `src/hooks/` - Reusable Logic

This folder contains custom React Hooks, which are reusable pieces of application logic.

*   `useDatabase.ts`: The primary data engine for the frontend. This critical hook contains the entire library of functions for communicating with the Supabase database, abstracting all fetching, creating, updating, and deleting of projects, tables, sheets, columns, and rows into easy-to-use functions.
*   `usePermissions.ts`: The application's rule book and permission checker. This hook determines what the currently logged-in user is allowed to do by checking their role for a specific project, which is crucial for showing or hiding UI elements accordingly.
*   `use-mobile.tsx`: A responsive design utility that checks the browser's window size to determine if the user is on a mobile device, enabling responsive UI changes.

#### 📁 `src/components/` - The User Interface (UI)

This is the largest directory, containing every visual element of the application.

##### Core Application Layout & Navigation
*   `LoginForm.tsx`: The user authentication screen with email and password inputs.
*   `ProjectsList.tsx`: The main dashboard for a logged-in user, displaying all projects they have access to.
*   `ProjectLayout.tsx`: A wrapper component providing a consistent layout (header, sidebar) for all pages within a single project.
*   `ProjectDetail.tsx`: The dashboard for a single project, listing all of its tables and forms.
*   `LeftSideBar.tsx`: The main navigation panel on the left of the screen, displaying a searchable list of tables and a link to the Forms section.

##### The "Excel" Interface
*   `ExcelTableDetail.tsx`: The orchestrator component for the spreadsheet view, managing the toolbar, sheet tabs, and the main data grid area.
*   `SheetDetail.tsx`: The core of the "Excel" experience. This component renders the `AgGridReact` data grid and is responsible for all cell-level interactions, data saving, real-time updates, and triggering the automation engine.
*   `ExcelSheetTabs.tsx`: Renders the clickable `Sheet1`, `Sheet2` tabs at the bottom of the grid interface.
*   `ExcelToolbar.tsx`: The toolbar located directly above the data grid, containing action buttons like "Add Column."
*   `FormulaBar.tsx`: The `fx` input bar for viewing and editing cell formulas.

##### The "Forms" Interface
*   `FormCreator.tsx`: The primary UI for building and designing custom forms.
*   `FormsList.tsx`: Displays the list of all forms created within a project.
*   `PublicFormPage.tsx`: The public-facing page that renders a form for non-logged-in users to view and submit.
*   `PublicFormRenderer.tsx`: The component that dynamically generates the input fields and layout for a public form based on its configuration.

##### Dialogs & Modals (Pop-ups)
*   `ColumnCreationDialog.tsx`: A powerful "smart" dialog that handles both creating new columns and editing existing ones. It contains the logic for configuring all column types and the "Automatic Mode" feature.
*   `ReferenceColumnPickerDialog.tsx`: An elegant dialog that provides a multi-step, collapsible interface for selecting a reference column from any Project, Table, and Sheet for automation.
*   `CreateTableDialog.tsx`: A simple form for creating a new table within a project.
*   `FormSharingDialog.tsx`: The pop-up that provides the public URL and sharing options for a form.
*   `ProjectSettingsModal.tsx`, `TableSettingsModal.tsx`, `SheetSettingsModal.tsx`: Pop-up dialogs for editing the settings of projects, tables, and sheets respectively. The sheet modal also includes delete functionality.
*   `DeleteConfirmationDialog.tsx`: A generic, reusable warning dialog to prevent accidental data deletion.
*   `DeleteDependenciesDialog.tsx`: A specific warning dialog shown when a user tries to delete data that is linked to by other records.
*   `ColumnReferencePicker.tsx` & `ProjectTablePicker.tsx`: Specialized selector components used as building blocks within other, more complex dialogs.

##### Specialized Components & Utilities
*   `TableActionsMenu.tsx`: The 3-dot dropdown menu next to each table in the `LeftSideBar`, providing actions like Rename, Duplicate, and Delete.
*   `LinkCellEditor.tsx` & `LinkCellRenderer.tsx`: Custom components for editing and displaying "Linked Record" cells within the data grid.
*   `RollupCellRenderer.tsx`: A custom component for displaying the calculated value of a rollup column within the data grid.
*   `MemberManagement.tsx`: The UI for inviting users to a project and managing their roles.
*   `SnapshotManagement.tsx`: The UI for the data backup and version control system.
*   `AIFeatures.tsx`: The user interface for interacting with the application's AI-powered features.
*   `AuditTrail.tsx`: A component that displays a historical log of user actions within a project.
*   `ErrorBoundary.tsx`: A safety-net component that catches crashes in other components and displays a friendly error message instead of a blank screen.
*   `accordion.tsx` & `scroll-area.tsx`: Generic, reusable UI primitive components created to support the functionality of the `ReferenceColumnPickerDialog`.

---

### Part 2: The Backend (`/supabase/functions/` Directory)

This folder contains secure, server-side Edge Functions that handle sensitive and complex operations.

*   `_shared/security.ts`: A library of reusable security helper functions used by other Edge Functions to authenticate users and check their permissions.
*   `evaluate-automated-columns/index.ts`: The engine for the "Automatic Mode" feature. This function receives a `sheet_id` and an optional `row_id`, securely queries for the relevant automation rules, evaluates them, and writes the results back into the database.
*   `create-row/index.ts`: A secure endpoint for creating new data rows, ensuring only authorized users can insert valid data.
*   `manage-members/index.ts`: Handles all logic related to project collaboration, such as inviting a new user or changing their role.
*   **Forms Functions (`forms-*`)**: A suite of functions dedicated to securely managing the creation, retrieval, and submission of forms.
*   **Other Functions (`ai-processor`, `audit-logger`, `snapshot-manager`)**: Specialized endpoints that provide the secure, server-side logic for the application's most advanced features.