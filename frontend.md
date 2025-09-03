
### **Frontend Architecture: An Overview**

The frontend is a modern **Single-Page Application (SPA)** built with React. It uses a component-based architecture and relies on a global **Context** for state management, particularly for authentication. Routing is handled by the `react-router-dom` library, which allows the application to show different "pages" (components) based on the URL without requiring a full page reload.

---

### **Feature Deep Dive: Frontend Login & Session Management**

*   **Purpose:** To provide a user interface for authentication, manage the user's session state across the application, and protect routes that require a user to be logged in.
*   **Architectural Approach:** The system is orchestrated by three key components working in concert:
    1.  `AuthContext.tsx`: The central "brain" for authentication state.
    2.  `App.tsx`: The top-level router that decides what to show based on the authentication state.
    3.  `LoginForm.tsx`: The UI component that the user interacts with.

#### **1. The State Manager: `AuthContext.tsx`**

This file creates a global state container (`AuthProvider`) that makes the user's authentication status and related functions available to every other component in the application.

*   **State Variables:**
    *   `user: User | null`: Stores the Supabase user object if someone is logged in, otherwise it's `null`. This is the primary indicator of an active session.
    *   `loading: boolean`: A crucial flag that is `true` while the context is checking for an existing session on startup. This prevents the UI from flickering between the login page and the dashboard.

*   **Core Functions:**
    *   `signIn(email, password)`: This is a wrapper function. It sets the `loading` state to `true` and then calls `supabase.auth.signInWithPassword()`. This is the direct link to the Supabase JS library, which in turn communicates with the Supabase Auth backend we documented earlier.
    *   `signUp(email, password)`: A similar wrapper for the Supabase `signUp` function.
    *   `signOut()`: A wrapper for the Supabase `signOut` function.

*   **Session Initialization & Management (`useEffect` hook):**
    1.  **Initial Check:** As soon as the application loads, a `useEffect` hook runs once. It makes an asynchronous call to `supabase.auth.getSession()` to check if a valid session token already exists in the browser's `localStorage`.
    2.  **State Update:**
        *   If a valid session is found, the `user` state is set to the session's user object.
        *   If no session exists or an error occurs, the `user` state is set to `null`.
    3.  **Loading Complete:** Critically, the `loading` state is set to `false` only *after* this check is complete.
    4.  **Real-time Listener (`onAuthStateChange`):** The context also subscribes to Supabase's `onAuthStateChange` event. This is a real-time listener. If the user logs in or out in another browser tab, or if their session expires, this listener will fire automatically, updating the `user` state and causing the application to react instantly without needing a manual refresh.

#### **2. The User Interface: `LoginForm.tsx`**

This is a controlled React component that renders the login form.

*   **State:** It uses local `useState` hooks to manage the `email`, `password`, and `loading` status of the form submission.
*   **Connecting to State (`useAuth`):** It gets access to the global `signIn` function by using the custom hook: `const { signIn } = useAuth()`.
*   **Submission Flow (`handleSubmit`):**
    1.  When the user clicks the "Sign In" button, the `handleSubmit` function is called.
    2.  It performs basic validation to ensure both fields are filled.
    3.  It sets its local `loading` state to `true`, disabling the form inputs and button to prevent multiple submissions.
    4.  It calls the global `signIn(email, password)` function from the `AuthContext`.
    5.  **Handling the Response:** It `await`s the result of the `signIn` call.
        *   **On Error:** If the `error` object is returned, it uses a `toast` notification to show a user-friendly message (e.g., "Invalid email or password").
        *   **On Success:** If the call is successful, it shows a "Successfully signed in!" toast.
    6.  **Redirection:** Upon a successful login, it uses the `useNavigate` hook from `react-router-dom` to programmatically redirect the user to the main dashboard page (`/`).

#### **3. The Router: `App.tsx`**

This file acts as the primary traffic controller for the application, deciding which components to render.

*   **Structure:** The entire application is wrapped in the `<AuthProvider>` and `<Router>` components, making the auth state and routing capabilities available everywhere.
*   **Public vs. Private Routes:**
    *   Routes like `/form/:formId` are defined outside of the `AppContent` component. These are **public routes** that do not require authentication.
    *   The `/*` route directs all other traffic to the `AppContent` component, which acts as the gatekeeper for all **private, authenticated routes**.

*   **The Gatekeeper Logic (`AppContent`):**
    1.  **Get Auth State:** The component gets the current `user` and `loading` status from the `useAuth()` hook.
    2.  **Loading State:** If `loading` is `true`, it renders a simple loading spinner. This is the crucial step that prevents the user from seeing a flash of the login page if they have a valid session.
    3.  **Authentication Check:** Once `loading` is `false`, it performs its main check: `if (!user)`.
        *   If `user` is `null` (no one is logged in), it returns the `<LoginForm />` component, effectively blocking access to the rest of the application.
        *   If `user` exists, it proceeds to render the main application layout, including the header, sidebar, and the `<Routes>` component that defines all the internal pages like `/`, `/project/:projectId`, etc.

This elegant system ensures that the login page is only shown when necessary and that all protected parts of the application are inaccessible until the `AuthContext` confirms a valid user session.


Of course. These two files are the perfect combination to document the main dashboard. The `useDatabase.ts` hook is the powerful engine, and `ProjectsList.tsx` is the user-facing vehicle it drives.

Here is the detailed documentation for the application's main dashboard page.

---

### **Feature Deep Dive: The  Dashboard**

*   **Purpose:** To serve as the main landing page for an authenticated user, displaying a list of all projects they have access to and providing the primary interface for creating, editing, and deleting those projects.
*   **Architectural Approach:** This feature is a prime example of React's "Hooks" pattern. All complex data-fetching and state-manipulation logic is encapsulated in the `useDatabase.ts` custom hook. The `ProjectsList.tsx` component is then a "declarative" consumer of this hook, focusing primarily on rendering the UI and handling user events.

#### **1. The Data Engine: `useDatabase.ts` Hook**

This custom hook is a centralized repository for all frontend-to-database communication. For the Projects Dashboard, the following functions are critical:

##### **`fetchProjects()`**
*   **Purpose:** To fetch a list of projects that the *currently logged-in user* is authorized to see.
*   **Security Implementation:** This function is where the frontend enforces the **Role-Based Access Control (RBAC)** security model we documented in the backend. It does not simply fetch all projects; it performs a query that joins `projects` with `project_members`.
    ```sql
    -- Conceptual Supabase query executed by fetchProjects()
    SELECT *, project_members!inner(*) 
    FROM projects 
    WHERE project_members.user_id = :current_user_id 
    AND is_deleted = false;
    ```
    The `!inner` join ensures that only projects for which the user has an entry in the `project_members` table are returned, effectively filtering the list based on their permissions.
*   **Data Enrichment:** The function processes the results to add a `userRole` property to each project object, making it easy for UI components to know the user's permission level for that specific project.

##### **`createProject()`**
*   **Purpose:** To create a new project and establish the creator as its owner.
*   **Execution Flow:**
    1.  It performs an `INSERT` into the `projects` table with the new project's name and the current user's ID as the `user_id` and `created_by`.
    2.  **Critical Step:** Upon a successful insert, it immediately performs a second `INSERT` into the `project_members` table, adding the current user as a member of the new project with the `role` of `'owner'`. This ensures that the creator always has full permissions.
    3.  It then performs a third `INSERT` into the `audit_logs` table to log the creation event.

##### **`updateProject()`**
*   **Purpose:** To modify the details of an existing project.
*   **Execution Flow:** It performs a simple `UPDATE` on the `projects` table, changing fields like `name` or `description`.

##### **`deleteProject()`**
*   **Purpose:** To "soft delete" a project and all its contents.
*   **Execution Flow:** This function is a multi-step "cascade" operation handled on the frontend:
    1.  It first fetches all tables belonging to the project.
    2.  It then loops through them and calls the `deleteTable()` function (also in `useDatabase`) for each one.
    3.  After all child tables are deleted, it performs an `UPDATE` on the `projects` table, setting `is_deleted: true` and recording a `deleted_at` timestamp. This is a **soft delete**, meaning the data is not permanently removed from the database and could potentially be recovered.
    4.  It then inserts a record into a `trash` table, allowing for a potential "undo" feature.

#### **2. The User Interface: `ProjectsList.tsx` Component**

This component is responsible for rendering the project cards and handling all user interactions on the dashboard.

*   **State Management:** It uses `useState` to manage the list of `projects`, the state of the delete confirmation dialog, and which project (if any) is currently being edited in-line.
*   **Initial Data Load (`useEffect`):** When the component first mounts, it calls the `loadProjects` function, which in turn calls `fetchProjects()` from the `useDatabase` hook. The returned projects are then stored in the component's state, triggering a re-render to display them.

#### **3. Detailed Interaction Flows**

##### **Creating a Project**
1.  The user clicks the "New Project" button, which calls the `handleCreateProject` function.
2.  `handleCreateProject` calls the `createProject()` function from the `useDatabase` hook.
3.  Upon success, it calls `loadProjects()` again to get the updated list, including the new project.
4.  **User Experience Enhancement:** To provide a smooth workflow, it then automatically puts the newly created project into an "editing" state, allowing the user to immediately rename it from "New Project..." to something meaningful.

##### **Editing a Project**
1.  The user hovers over a project card, revealing an "Edit" icon.
2.  Clicking the icon calls `startEditingProject`, which sets the `editingProject` state variable to the ID of that project.
3.  This state change causes the component to re-render. The card for the editing project now displays input fields for the name and description instead of plain text.
4.  The user modifies the text and clicks a "Save" icon.
5.  This calls `saveProjectEdit`, which in turn calls `updateProject()` from the `useDatabase` hook, passing the new values.
6.  Upon success, `loadProjects()` is called to refresh the data, and the `editingProject` state is set back to `null`, returning the card to its normal display mode.

##### **Deleting a Project**
1.  The user hovers over a project card and clicks the "Delete" (trash) icon.
2.  This calls `openDeleteDialog`, which sets the state to open the `DeleteConfirmationDialog` component, passing in the project to be deleted.
3.  The modal appears, asking for confirmation.
4.  If the user confirms, the dialog's `onConfirm` prop is called, which executes `handleDeleteProject`.
5.  `handleDeleteProject` calls the `deleteProject()` function from the `useDatabase` hook.
6.  Upon success, `loadProjects()` is called to show the updated list, and the confirmation dialog is closed.


---

### **Feature Deep Dive: The Project Dashboard**

*   **Purpose:** To serve as the central hub for a single project. After a user selects a project from the main list, this is their primary workspace for managing the project's tables, members, and other settings.
*   **Architectural Approach:** This view is composed of two main components:
    1.  **`ProjectLayout.tsx`**: A high-level "shell" or "chrome" that provides consistent navigation and structure for all pages *within* a project.
    2.  **`ProjectDetail.tsx`**: The main content component for the project's landing page, acting as a dashboard with a tabbed interface to access different features.

#### **1. The Shell Component: `ProjectLayout.tsx`**

This component is responsible for creating the persistent user interface that surrounds the main content area of a project.

*   **Responsibilities:**
    *   **Data Fetching:** Upon loading, it fetches the details for the specific `projectId` from the URL to display the project's name in the header.
    *   **Header & Breadcrumbs:** It renders the top header bar, which includes a "breadcrumb" navigation trail (e.g., `Home > Project Name`) to help users orient themselves.
    *   **Sidebar Rendering:** It renders the crucial `LeftSidebar` component, which is the primary navigation for switching between different tables within the project.
    *   **Modal Management:** It manages the state for modals that can be opened from anywhere within the project, such as the `EnhancedTableCreationDialog` (triggered from the sidebar) and the `ProjectSettingsModal` (triggered from the header).
    *   **Content Container:** It acts as a wrapper, rendering any child components (like `ProjectDetail.tsx`) passed to it in the main content area.

#### **2. The Hub Component: `ProjectDetail.tsx`**

This is the main dashboard for a single project. It's a sophisticated component that serves as a central hub for managing many different aspects of the project.

##### **Security First: The `usePermissions` Hook**
A critical architectural pattern is introduced here. The very first thing this component does is call a new custom hook: `const permissions = usePermissions(projectId)`.

*   **Purpose:** This hook is the frontend's direct interface to the **Role-Based Access Control (RBAC)** system. It takes the `projectId` and determines the current user's permissions for that specific project.
*   **Gating Access:** The component renders nothing until the permission check is complete (`if (permissions.loading)`). If the check reveals the user does not have `canView` permission, it renders an "Access Denied" message and stops, effectively securing the entire project view on the client-side. This is a crucial security checkpoint.

##### **Tab-Based Interface**
The core of the UI is a tabbed navigation system that organizes the project's features into logical sections. The visibility of these tabs is **permission-driven**.

*   **`Tables` (Default Tab):** Displays a list of all data tables within the project. This is the primary content and is always visible.
*   **`Members` Tab:** Renders the `MemberManagement` component. This tab is **only visible** if `permissions.canManageMembers` is true.
*   **`Snapshots` Tab:** Renders the `SnapshotManagement` component for data backups. This tab is **only visible** if `permissions.canCreateSnapshots` is true.
*   **`Activity` Tab:** Renders the `AuditTrail` component, showing a history of changes. This is always visible to users with view access.
*   **`AI Features` Tab:** Renders the `AIFeatures` component. This tab is **only visible** if `permissions.canUseAI` is true.

##### **The "Tables" Tab: Managing Project Data Tables**
This tab functions very similarly to the main `ProjectsList` dashboard but for tables instead of projects.

*   **Data Fetching:** It calls the `loadTables` function, which in turn calls `fetchTables(projectId)` from the `useDatabase` hook to get the list of tables for the current project.
*   **UI:** It renders a grid of interactive cards, one for each table.
*   **CRUD Operations:** It provides the full suite of Create, Read, Update, and Delete operations for tables, with actions being conditionally rendered based on permissions (e.g., the "New Table" and "Delete" buttons only appear if `permissions.canEditStructure` is true).

#### **3. The Data Layer: `useDatabase.ts` Functions**

The `ProjectDetail` component relies on several functions from the `useDatabase` hook.

##### **`fetchTables(projectId)`**
*   **Purpose:** To fetch a list of all tables that belong to a specific project.
*   **Data Fetching Logic:**
    1.  It queries the `better_tables` table, filtering by the provided `projectId`.
    2.  **Data Enrichment:** It performs a nested select to also fetch the `id` of all associated `better_sheets` and `rows`.
    3.  **Client-Side Aggregation:** It then processes this nested data on the client-side to calculate a `row_count` for each table. This provides a useful summary metric for the UI but could be a performance consideration for tables with a very large number of rows.

##### **`createTable(projectId, name)` & `updateTable(tableId, updates)`**
*   These functions perform simple `INSERT` and `UPDATE` operations on the `better_tables` table, scoped to the current user and project.

##### **`deleteTable(tableId)`**
*   This is another multi-step "soft delete" operation handled on the frontend. It first deletes all sheets within the table, then updates the table's `is_deleted` flag to `true`, and finally adds a record to the `trash` table.



### **Feature Deep Dive: The Project Dashboard (Child Components)**

The `ProjectDetail` component acts as a container for several powerful "sub-page" components, each rendered within a tab. Here we document the functionality of each of these child components.

#### **5.1. The `MemberManagement` Component**

*   **Purpose:** To provide a user interface for all collaboration features, including listing current members, inviting new ones, and managing their roles.
*   **Backend Connection:** This component is the direct frontend counterpart to the `manage-members` Deno Edge Function. Every action it performs is a `supabase.functions.invoke('manage-members', ...)` call.

##### **Data Fetching and Display**
*   **`fetchMembers()`:** When the component mounts, it calls the `manage-members` function with the `action: 'list'`. The backend returns an enriched list of members, including their email addresses, which is then stored in the component's state and rendered in a table.
*   **UI:** The component displays members in a clear table format. It uses helper objects (`ROLE_COLORS`, `ROLE_ICONS`) to render visually distinct badges for each role, improving clarity.

##### **Interaction Flows**
*   **Invite Member:**
    1.  A user with `canManageMembers` permission clicks the "Invite Member" button, opening a dialog.
    2.  They fill in the new member's email and select a role from a dropdown. The available roles are dynamically filtered based on the *current user's* role (an Owner can create Admins, but an Admin cannot).
    3.  On submission, the component calls the `manage-members` function with `action: 'invite'` and the form data.
    4.  The backend handles the invitation logic, and on success, the component re-fetches the member list to show the new addition.
*   **Change Role / Remove Member:**
    1.  For each member in the list (except the current user), a dropdown menu is available.
    2.  **To Remove:** The user selects "Remove Member," which triggers a confirmation dialog. Upon confirmation, the component calls `manage-members` with `action: 'remove'` and the `member_id`.
    3.  **To Change Role (Future Work):** The UI includes a "Change Role" menu item, but the full implementation (e.g., a dedicated dialog to select the new role) is marked as a `TODO`. When implemented, it will call `manage-members` with `action: 'change_role'`.

#### **5.2. The `SnapshotManagement` Component**

*   **Purpose:** To provide a UI for the application's data backup and restore functionality.
*   **Backend Connection:** This component is the direct frontend for the `snapshot-manager` Deno Edge Function.

##### **Data Fetching and Display**
*   When the component mounts, it calls `snapshot-manager` with `action: 'list'` to retrieve a list of all existing snapshots for the project.
*   The snapshots are displayed as a list of cards, each showing its name, notes, and creator details.

##### **Interaction Flows**
*   **Create Snapshot:**
    1.  A user with `canCreateSnapshots` permission clicks the "Create Snapshot" button, opening a dialog.
    2.  They provide a mandatory name and an optional note for the snapshot.
    3.  On submission, the component calls `snapshot-manager` with `action: 'create'`.
    4.  The backend performs the complex backup operation, and on success, the component re-fetches the snapshot list.
*   **Restore Snapshot:**
    1.  The user selects "Restore from This Snapshot" from a snapshot's dropdown menu.
    2.  A critical warning dialog appears, forcing the user to acknowledge that this is a destructive action that will overwrite all current data.
    3.  Upon confirmation, the component calls `snapshot-manager` with `action: 'restore'` and the `snapshot_id`. The UI enters a loading state for that specific snapshot until the operation is complete.
*   **Delete Snapshot:**
    1.  The user selects "Delete Snapshot" and confirms via a dialog.
    2.  The component calls `snapshot-manager` with `action: 'delete'` and the `snapshot_id`.

#### **5.3. The `AuditTrail` Component**

*   **Purpose:** To provide a user-friendly, filterable view of the project's history, as recorded in the `audit_logs` table.
*   **Backend Connection:** This component communicates with the `audit-logger` Deno Edge Function.

##### **Data Fetching and Display**
*   When the component mounts, it makes two calls to the `audit-logger` function:
    1.  `action: 'get_stats'`: To retrieve high-level statistics (total actions, active users, etc.) which are displayed in summary cards at the top.
    2.  `action: 'get_timeline'`: To fetch the initial list of log entries.
*   **UI:** Each log entry is rendered as an item in a timeline, with a distinct icon and color-coded badge based on the `action_type`. The details of each log entry are available in a collapsible `<details>` section.

##### **Interaction Flows**
*   **Filtering:** The UI provides input fields to filter the timeline by user email or by the type of entity (`target_type`). When the user applies a filter, it re-calls `fetchLogs` with the new filter parameters.
*   **Pagination:** The component implements "load more" functionality. When the user clicks the "Load More" button, it calls `fetchLogs` again, providing the current number of logs as the `offset`, and appends the new results to the existing list.

#### **5.4. The `AIFeatures` Component**

*   **Purpose:** To provide the user interface for interacting with the AI-powered features.
*   **Backend Connection:** This component is the direct frontend for the `ai-processor` Deno Edge Function.

##### **Interaction Flows**
*   **Rule Builder:**
    1.  A user clicks "Create Rule," opening a dialog.
    2.  They type a natural language description of their desired rule.
    3.  On submission, the component calls `ai-processor` with `action: 'create_rule'`, sending the description and the relevant `column_id`.
    4.  The backend communicates with the Gemini API. The AI-generated rule `definition` is returned to the frontend and displayed as a preview for the user. The rule is now saved in the database but is inactive.
*   **Data Cleanup & Smart Fill:**
    1.  The user clicks "Cleanup Data" or "Fill Missing Data," opening a corresponding dialog.
    2.  They paste their data into a `Textarea` and select an operation or source table.
    3.  The component calls `ai-processor` with the appropriate action (`cleanup_data` or `fill_data`) and the user's data.
    4.  The backend gets a response from the Gemini API.
    5.  Crucially, **no data is saved automatically**. The backend simply returns the AI's *suggestions* to the frontend. The component then renders these suggestions in a list, showing the original value, the suggested change, and the AI's confidence level, allowing the user to review them before deciding to apply them.



    This is a massive and incredibly insightful set of files. They represent the absolute core of the application's functionality. We can now document the entire spreadsheet experience, from its high-level layout to the intricate details of the data grid.

Here is the detailed documentation for the spreadsheet view.

---

### **Feature Deep Dive: The Spreadsheet View**

*   **Purpose:** To provide the primary user experience of an advanced, interactive spreadsheet. This is where users enter, edit, and interact with their data at the cell level.
*   **Architectural Approach:** This feature uses a sophisticated, hierarchical component structure. A main orchestrator (`ExcelTableDetail`) manages the overall layout, while a specialized child component (`SheetDetail`) encapsulates the complex logic of the data grid itself. The entire system is powered by the `useDatabase` hook for data operations and wrapped in multiple contexts (`FullscreenProvider`, `FormattingProvider`) for shared state.

#### **1. The Orchestrator: `ExcelTableDetail.tsx`**

This component is the high-level container for the entire spreadsheet interface. It does not contain the grid itself but manages all the surrounding UI elements and state.

*   **Responsibilities:**
    *   **Data Fetching:** It fetches the parent `project` and `table` details to display in the header. It also calls `fetchSheets()` to get the list of all sheets belonging to the current table.
    *   **Sheet Management:** It manages the state for which sheet is currently `activeSheetId`.
    *   **UI Rendering:** It renders the main layout, which includes:
        *   A header with the table name and a button for "Table Settings".
        *   An `ExcelToolbar` component for common actions like "Add Column".
        *   The `SheetDetail` component, passing the `activeSheetId` to it as a prop. This is how the grid knows which sheet's data to display.
        *   An `ExcelSheetTabs` component at the bottom for navigating between sheets.
    *   **Event Handling:** It handles all sheet-level operations triggered by the `ExcelSheetTabs` component, such as creating, renaming, and deleting sheets, by calling the corresponding functions from the `useDatabase` hook.

#### **2. The Core Component: `SheetDetail.tsx`**

This is the most complex and critical frontend component in the application. It is singularly responsible for rendering and managing the AG Grid data grid and all cell-level interactions.

##### **Data Fetching and Real-time Updates**
*   **Initial Load (`loadData`):** When the component mounts (or when the `sheetId` prop changes), it executes a `loadData` function. This function makes parallel calls to `fetchColumns(sheetId)` and `fetchRows(sheetId)` to get all the data needed to build the grid.
*   **Real-time Subscription:** It uses Supabase Channels to subscribe to real-time changes in the `rows` table for the current sheet (`channel('realtime-sheet:{sheetId}')`). If another user modifies a row, the listener receives the event, shows a toast notification, and re-runs `loadData()` to refresh the grid with the latest information, enabling real-time collaboration.

##### **Grid and Data Transformation (`setupGridData`)**
*   This crucial function takes the raw `columns` and `rows` data from the database and transforms it into the specific format required by the AG Grid library.
*   **Column Definitions (`ColDef`):** It iterates through the database `columns` to create an array of `ColDef` objects. This is where it configures every aspect of a grid column:
    *   `headerName`: The user-visible name (e.g., "A - Status").
    *   `field`: The column's `id`, used to map to the correct key in the `rowData`.
    *   `editable`, `sortable`, `resizable`: Standard grid behaviors.
    *   **Cell Renderers/Editors:** This is the most important part. A `switch` statement on the column's `data_type` assigns specialized React components to render and edit different types of cells (e.g., `LinkCellEditor`, `RollupCellRenderer`, `FormattedCellEditor`). This is what enables the advanced column types.
*   **Row Data:** It maps the array of `rows` from the database. Each database row (which contains a `row_data` JSONB object) is transformed into a flat JavaScript object that AG Grid can understand (e.g., `{ "col_id_1": "value A", "col_id_2": 123 }`).
*   **Empty Rows:** It intelligently adds empty rows to the bottom of the grid to ensure the user always has a place to start typing new data, improving the "Excel-like" feel.

##### **Interaction Flow: Saving Data (`handleCellValueChanged`)**
This function is the heart of the data-saving logic. It is triggered by AG Grid whenever a user edits a cell.

1.  **Validation:** It first finds the column definition and calls `validateColumnData` from the `useDatabase` hook to check for required fields or data type mismatches. If validation fails, the change is reverted, and an error toast is shown.
2.  **Saving State:** It sets a `savingStatus` state to 'saving', providing immediate visual feedback to the user.
3.  **Create vs. Update:** It checks if the row being edited is a new, empty row (its ID starts with `'empty-'`).
    *   If it's a **new row**, it calls the `createRow()` function from `useDatabase`.
    *   If it's an **existing row**, it calls the `updateRow()` function.
4.  **Triggering Automation:** After a successful save (and only if it was a real row, not an empty one), it critically calls `triggerAutomatedColumnEvaluation(sheetId, userId, rowId)`. This invokes the backend Deno function to re-calculate any automatic columns in that row.
5.  **UI Refresh:** It then re-fetches the updated row data from the database to display the results of the automation and provides a "Saved" status to the user.

#### **3. The Data Layer: `useDatabase.ts` Functions**

The spreadsheet view relies heavily on the `useDatabase` hook for all its data operations.

*   **`fetchColumns(sheetId)`:** Performs a `SELECT *` from the `columns` table, filtered by `sheet_id`.
*   **`fetchRows(sheetId)`:** Performs a `SELECT *` from the `rows` table, filtered by `sheet_id`.
*   **`createRow(sheetId, rowData)`:** This is a crucial security and logic choice. Instead of a simple `supabase.from('rows').insert()`, it calls the **`create-row` Deno Edge Function**. This delegates the creation logic to the secure backend, which can enforce permissions and other business rules.
*   **`updateRow(rowId, rowData)`:** Performs a standard `UPDATE` on the `rows` table.
*   **`triggerAutomatedColumnEvaluation(...)`:** Invokes the `evaluate-automated-columns` Deno Edge Function, which is the link between a frontend data change and the backend automation engine.
*   **Configuration Fetchers:** Functions like `fetchLinkConfiguration`, `fetchRollupConfiguration`, and `getAutomatedColumnConfig` are used to get the specific settings needed to correctly render and manage advanced column types.


You've asked an excellent question. "How about the excel view?" gets to the very heart of the application's user experience. We've documented the components (`ExcelTableDetail`, `SheetDetail`) and the data flow, but it's crucial to synthesize that information into a clear description of the **user-facing "Excel View" itself.**

Based on the components we have analyzed, here is a detailed breakdown of the complete "Excel View" and its features.

---

### **Feature Deep Dive: The "Excel View" User Experience**

The "Excel View" is the core interface of the application, designed to provide a familiar yet powerful spreadsheet experience. It is not a single component but an orchestrated collection of several components working together to create a cohesive workspace.

#### **1. The Overall Layout & Key Components**

When a user opens a table, the screen is organized into five distinct functional areas:

1.  **Header (`ExcelTableDetail.tsx`):**
    *   Located at the very top, this area provides context. It displays the project and table name, a "Back" button to return to the project dashboard, and a "Table Settings" button. It remains static while the user works within the spreadsheet.

2.  **Formatting Toolbar (`FormattingToolbar.tsx`):**
    *   A classic toolbar located directly below the header. It contains common text formatting options like **Bold**, *Italic*, `Strikethrough`, text alignment, font color, and background color.
    *   **Functionality:** It is context-aware. The buttons in this toolbar are directly linked to the `FormattingContext`. When a user selects a cell in the grid, the toolbar updates to reflect that cell's current formatting. When the user clicks a button, the context is updated, and the selected cell's appearance changes instantly.

3.  **Formula Bar (`FormulaBar.tsx`):**
    *   Positioned below the formatting toolbar, this component is a staple of any spreadsheet application.
    *   **Functionality:**
        *   **Display:** When a user clicks on a cell, this bar shows the raw, underlying content of that cell—either the plain text/number or the formula (e.g., `=SUM(A1:A5)`).
        *   **Editing:** The user can click into the formula bar to edit the selected cell's contents, providing more space and a dedicated area for writing complex formulas.

4.  **The Data Grid (`SheetDetail.tsx` using `AgGridReact`):**
    *   This is the main content area, the "sheet" itself. It is a highly interactive grid of cells organized into rows and columns.
    *   **Columns:**
        *   Each column has a header displaying an Excel-style letter (`A`, `B`, `C`...) and the user-defined column name (e.g., "Status").
        *   Column headers have context menus (right-click or click a settings icon) that allow users to **edit column settings** (like changing the data type) or delete the column.
    *   **Rows:**
        *   Rows are numbered sequentially down the left-hand side.
        *   Users can select single rows, multiple rows, or ranges of cells.
    *   **Cell Interaction:**
        *   Users can double-click a cell to start editing its value directly in the grid.
        *   As documented, different column types will present different editing experiences (e.g., a "Select" column will show a dropdown, a "Link" column will open the `LinkCellEditor`).
    *   **Real-time Updates:** The grid is connected to a real-time subscription. If another user makes a change to the same sheet, the data in the grid will automatically refresh, and a notification will appear.

5.  **Sheet Tabs (`ExcelSheetTabs.tsx`):**
    *   Located at the very bottom of the view, this component mimics the sheet tabs in Excel or Google Sheets.
    *   **Functionality:**
        *   **Navigation:** Users can click on a tab (e.g., "Sheet1", "Sheet2") to switch the `SheetDetail` component to display the data for that sheet.
        *   **Management:** A `+` button allows users to create new sheets. Each tab has a dropdown menu with options to **Rename**, **Delete**, or **Duplicate** the sheet.
        *   **Business Rule:** The component enforces the rule that the last sheet in a table cannot be deleted.

#### **2. The "Smart" Grid: Advanced Column Types**

What elevates this from a simple data table to an "advanced spreadsheet" is the functionality embedded within the grid cells themselves, driven by the `cellRenderer` and `cellEditor` configurations in `SheetDetail.tsx`.

*   **Formatted Cells (`FormattedCellRenderer` / `Editor`):** Standard cells use these components, which are connected to the `FormattingContext`. This is how custom formatting (bold, colors, etc.) is applied and saved on a per-cell basis.
*   **Linked Record Cells (`LinkCellRenderer` / `Editor`):** When a user interacts with a "Link" column, these components provide a specialized UI. The renderer displays the linked record as a colored "pill" with its name. The editor opens a search interface allowing the user to find and select a record from another table to link to.
*   **Rollup Cells (`RollupCellRenderer`):** These cells are read-only. The renderer is responsible for displaying the calculated value (e.g., a sum or count) that is computed by the backend's rollup engine. It likely shows a small "rollup" icon or similar indicator.
*   **Automatic Data Saving:** The grid is configured with an `onCellValueChanged` event handler. As soon as a user finishes editing a cell and presses Enter or clicks away, a background process is triggered to validate the data, save it to the database, and trigger any backend automations. A small "Saving..." -> "Saved" indicator provides feedback to the user, eliminating the need for a manual save button.






Of course. This `FormsList.tsx` component is the final major piece of the application's UI that we needed to see. It's a comprehensive "dashboard" for the Forms feature, and analyzing it reveals the entire user flow for form management.

Here is the detailed documentation for the Forms user interface.

---

### **Feature Deep Dive: The Forms User Interface**

*   **Purpose:** To provide a complete user interface for creating, managing, sharing, and viewing the submissions of public data-entry forms.
*   **Architectural Approach:** This feature is implemented as a "state machine" within a single, powerful component, `FormsList.tsx`. This component manages several views (the list, the creator, the settings, and the submission manager) and conditionally renders the appropriate one based on the user's actions. It communicates with a suite of `forms-*` Deno Edge Functions on the backend.

#### **1. The Hub Component: `FormsList.tsx`**

This component serves as the main dashboard for all forms within a specific project.

##### **State Management & Views**
The component uses `useState` to manage which "view" is currently active. This is the core of its state machine logic:
*   **Default View (List):** If `showCreateForm`, `showManageForm`, and `showFormSettings` are all `false`/`null`, it displays the main list of all created forms.
*   **Creator View:** If `showCreateForm` is `true`, it hides the list and instead renders the `<FormCreator />` component.
*   **Management View:** If `showManageForm` has a `formId`, it renders the `<FormManagement />` component, which is responsible for viewing submissions for that specific form.
*   **Settings View:** If `showFormSettings` has a `formId`, it renders the `<EnhancedFormSettings />` component for configuring the form's behavior.

##### **Data Fetching (`loadForms`)**
*   When the component mounts, it calls `loadForms()`. This function makes a direct `supabase.from('forms').select('*')` call, filtered by the current `projectId`, to retrieve the list of all forms to be displayed.

##### **Primary "List View" Functionality**
*   **Display:** It renders the fetched forms as a grid of interactive cards. Each card provides key information at a glance, such as the form name, its active status, when it was created, and how many questions it has.
*   **Search:** A search input allows users to filter the forms on the client-side by name or description.
*   **"Create Form" Action:** The main "Create Form" button sets `setShowCreateForm(true)`, switching the component to the Creator View.

##### **Form Card Actions**
Each form card has a set of buttons for management:
*   **Manage Submissions (`<Eye />`):** Sets the `showManageForm` state, switching to the Management View for that form.
*   **Share (`<Share />`):** Calls the `shareForm` function. This function communicates with the backend (likely a `forms-share` function) to generate a unique public URL for the form, which it then attempts to copy to the user's clipboard.
*   **Settings (`<Settings />`):** Sets the `showFormSettings` state, switching to the Settings View.
*   **Duplicate (`<Copy />`):** Calls the `duplicateForm` function. This invokes a `forms-get` backend function to fetch the full details of the original form (including all its questions), and then immediately calls a `forms-create` function to create a new form with the copied details.
*   **Delete (`<Trash2 />`):** After a confirmation dialog, this calls `deleteForm`, which performs a **soft delete** on the form by setting `is_deleted: true`.

#### **2. The Child Components (Inferred Functionality)**

While we haven't seen the code for the child components, `FormsList.tsx` tells us exactly what they do.

*   **`FormCreator.tsx` (Creator View):**
    *   **Purpose:** To provide a user interface for building a new form from scratch.
    *   **Functionality:** This is likely a complex component with a drag-and-drop interface or a multi-step wizard that allows a user to:
        1.  Give the form a name and description.
        2.  Add questions to the form.
        3.  For each question, define its label, type (text, number, etc.), and—most importantly—**map it to a specific table and column in the database**. This mapping is the core logic of the form builder.
    *   **On Save:** When the user saves the form, this component calls a `forms-create` backend function, passing the complete form definition (name, settings, and the array of questions with their mappings).

*   **`FormManagement.tsx` (Management View):**
    *   **Purpose:** To display and manage the submissions received for a single form.
    *   **Functionality:** This component likely fetches data from the `form_submissions` table for the given `formId`. It would display submissions in a table or list, allowing the user to view the data, see any processing errors, and potentially approve or reject submissions.

*   **`EnhancedFormSettings.tsx` (Settings View):**
    *   **Purpose:** To configure the behavior and appearance of a form.
    *   **Functionality:** This component would render a form that allows the user to edit properties stored in the `forms` table, such as the `success_message`, `is_active` status, `passcode`, and `close_date`.