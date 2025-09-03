PLANED FUTURE LOGIN PAGE RELATED
### **1.1. Planned Features & Future Work**

This section outlines features that are planned but not yet implemented. It details the required changes for both the frontend and backend to bring these features to life.

---

### <span style="color:orange;">**8.1. User Sign Up**</span>

*   **Goal:** To allow new users to create an account for the application directly from the login page.
*   **Current Status:** The backend is already capable of handling sign-ups via Supabase Auth, and the `AuthContext` has a `signUp` function ready. The primary missing piece is the user interface.

#### **Frontend Implementation Plan**

1.  **Modify `LoginForm.tsx`:**
    *   **UI Change:** Add a link or button below the "Sign In" button, such as "Don't have an account? **Sign Up**".
    *   **State Management:** Create a new state variable, perhaps `const [isSignUp, setIsSignUp] = useState(false)`, to toggle between the Login and Sign Up views.
    *   **UI Change:** When `isSignUp` is `true`:
        *   Change the card title from "Sign In" to "Create Account".
        *   Add a "Confirm Password" input field to the form.
        *   Change the submit button text to "Sign Up".
    *   **Logic Change:** Modify the `handleSubmit` function.
        *   If `isSignUp` is true, it should first validate that the password and confirm password fields match.
        *   It should then call the `signUp(email, password)` function from the `AuthContext`.
        *   **On Success:** The Supabase Auth `signUp` function typically returns a successful response but requires the user to confirm their email. The UI should display a clear success message like, "Account created! Please check your email to confirm your account."
        *   **On Error:** Handle potential errors, such as "User already registered."

2.  **Modify `AuthContext.tsx`:**
    *   **No changes are required.** The `signUp` function, which wraps `supabase.auth.signUp()`, is already implemented and ready to be used.

---

### <span style="color:orange;">**8.2. Forgot/Reset Password**</span>

*   **Goal:** To provide a secure way for users who have forgotten their password to reset it via an email link.
*   **Current Status:** Supabase Auth has this functionality built-in. We need to create the user interface to trigger it and a page to handle the password reset itself.

#### **Backend Implementation Plan**

1.  **Supabase Configuration:**
    *   **Action:** Ensure that an **Email Template** for "Reset Password" is configured in the Supabase project settings. This template must contain the `{{ .Token }}` variable, which Supabase will replace with a secure, one-time-use link for the user to reset their password.
    *   **No backend code changes are needed.** The entire logic of generating a secure token, sending the email, and validating the token is handled by Supabase Auth.

#### **Frontend Implementation Plan**

This feature requires two distinct new UI components.

##### **Phase 1: Triggering the Password Reset**

1.  **Modify `LoginForm.tsx`:**
    *   **UI Change:** Add a "Forgot Password?" link near the password input field.
    *   **New Component:** This link should navigate the user to a new page/component, for example, `/forgot-password`, rendered by a component named `ForgotPasswordForm.tsx`.

2.  **Create `ForgotPasswordForm.tsx` (New File):**
    *   **UI:** This component will display a simple form with a single input field for the user's `email` and a "Send Reset Link" button.
    *   **Logic:**
        *   When the form is submitted, it will call a new function that needs to be added to the `AuthContext`.
        *   The function in `AuthContext` will call `supabase.auth.resetPasswordForEmail(email)`.
        *   **On Success:** The UI should display a persistent message like, "If an account with that email exists, a password reset link has been sent." (This generic message prevents email enumeration attacks).

3.  **Modify `AuthContext.tsx`:**
    *   **New Function:** Add a new function to the `AuthContextType` and its implementation:
        ```typescript
        // In AuthContextType
        resetPassword: (email: string) => Promise<any>;
        
        // In AuthProvider
        const resetPassword = async (email: string) => {
          return await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: 'http://yourapp.com/update-password', // URL of the page from Phase 2
          });
        };
        ```
        *Note: The `redirectTo` URL is critical and must be configured in your Supabase project's allowed redirect URLs.*

##### **Phase 2: Handling the Password Update**

When the user clicks the link in their email, they will be directed to a page like `http://yourapp.com/update-password` with a secure token in the URL.

1.  **Create `UpdatePasswordForm.tsx` (New File):**
    *   **UI:** This component will have two input fields: "New Password" and "Confirm New Password", and an "Update Password" button.
    *   **Logic:**
        *   This component will listen for auth state changes. When the user arrives from the email link, Supabase's library will automatically handle the token in the URL and sign the user into a special "re-authentication" state.
        *   The form's `onSubmit` handler will call a new function in the `AuthContext`.
        *   The function in `AuthContext` will call `supabase.auth.updateUser({ password: newPassword })`.
        *   **On Success:** The user's password is now updated. The UI should show a success message and provide a button to navigate to the main login page.

2.  **Modify `AuthContext.tsx`:**
    *   **New Function:** Add the `updateUserPassword` function:
        ```typescript
        // In AuthContextType
        updateUserPassword: (password: string) => Promise<any>;

        // In AuthProvider
        const updateUserPassword = async (password: string) => {
          return await supabase.auth.updateUser({ password });
        };
        ```

3.  **Modify `App.tsx`:**
    *   **New Route:** Add a new public route to handle the password reset page:
        ```typescript
        // In the main Router
        <Route path="/update-password" element={<UpdatePasswordForm />} />
        ```

PLANED IMPROVEMENT FOR PROJECT DASHBOARD 


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

### **Recommendations for Improvement PROJECT DASHBOARD**

#### **1. User Experience (UX) & Feature Enhancements**

These changes focus on making the application more intuitive, powerful, and pleasant to use.

*   <span style="color:orange;">**Implement a Dedicated Role Change Dialog**</span>
    *   **Problem:** In `MemberManagement.tsx`, the "Change Role" action is currently a `TODO`. A simple dropdown menu is not ideal because it doesn't provide context about what each role means.
    *   **Suggestion:** When a user clicks "Change Role," open a dedicated dialog. This dialog should show the member's email, their current role, and a `Select` component to choose the new role. Below the select, it should display the description of the chosen role (from `ROLE_DESCRIPTIONS`) so the admin knows exactly what permissions they are granting.
    *   **Implementation:**
        *   **`[TODO: Frontend]`** In `MemberManagement.tsx`, create a new state to manage the "change role" dialog's visibility and the member being edited. Build a new `Dialog` component that takes this state and provides the UI and logic to call the `handleChangeRole` function.

*   <span style="color:orange;">**Add Search/Filter to Member List and Snapshot List**</span>
    *   **Problem:** In projects with many members or dozens of snapshots, finding a specific one requires manual scrolling.
    *   **Suggestion:** Add a simple search input above the tables in `MemberManagement.tsx` and `SnapshotManagement.tsx`. This would filter the lists on the client-side by member email or snapshot name.
    *   **Implementation:**
        *   **`[TODO: Frontend]`** In both components, add a new state variable for the search term. Before mapping over the `members` or `snapshots` array to render the list, filter it based on the search term.

*   <span style="color:orange;">**Make Audit Log Targets Clickable**</span>
    *   **Problem:** The `AuditTrail.tsx` component shows actions like "User updated row in Table X," but this is just static text. The user cannot easily navigate to the item being referenced.
    *   **Suggestion:** Make the "target" of an audit log entry a clickable link. For example, if the `target_type` is a `row`, the link could navigate the user to that table and highlight the specific row.
    *   **Implementation:**
        *   **`[TODO: Frontend]`** In `AuditTrail.tsx`, when rendering each log, check the `target_type` and `target_id`. If it's a known type, render a React Router `<Link>` component that points to the appropriate URL (e.g., `/project/{projectId}/table/{tableId}`).
        *   **`[TODO: Backend]`** The `audit-logger` function might need to be enhanced to return more contextual information, such as the `table_id` and `sheet_id` for a `row` action, to make constructing these links easier.

#### **2. Performance Optimization**

These changes will make the application feel snappier and reduce unnecessary load on the backend.

*   <span style="color:red;">**Refactor `fetchTables` to Move Aggregation to the Database**</span>
    *   **Problem:** The `fetchTables` function in `useDatabase.ts` currently fetches all sheets and all row IDs for every table and then calculates the `row_count` on the client-side. For a project with many tables and millions of rows, this would transfer a huge amount of unnecessary data and could crash the browser.
    *   **Suggestion:** Create a PostgreSQL function (an `RPC` call in Supabase) that calculates the row count on the database server.
    *   **Implementation:**
        *   **`[TODO: Backend]`** Create a new SQL function, e.g., `get_tables_with_counts(p_project_id)`, that performs the joins and `COUNT(*)` aggregation directly within the database and returns the final, aggregated data.
        *   **`[TODO: Frontend]`** The `fetchTables` function in `useDatabase.ts` would be simplified to a single `supabase.rpc('get_tables_with_counts', { p_project_id: projectId })` call. This would drastically reduce the amount of data transferred and improve performance.

*   <span style="color:orange;">**Centralize and Cache Project Data**</span>
    *   **Problem:** Both `ProjectLayout.tsx` and `ProjectDetail.tsx` call `fetchProjects()` independently to get the current project's name and details. This results in redundant network requests for the same data.
    *   **Suggestion:** Create a `ProjectContext` that wraps the `ProjectLayout`. This context would be responsible for fetching the project data *once* and providing it to all child components (`ProjectLayout`, `ProjectDetail`, etc.).
    *   **Implementation:**
        *   **`[TODO: Frontend]`** Create a new file `src/context/ProjectContext.tsx`. This context would fetch the project on mount and provide the `project` object and a `refreshProject` function. The `ProjectLayout` and `ProjectDetail` components would then consume this context using a `useProject()` hook instead of fetching the data themselves.

*   <span style="color:orange;">**Debounce Filter Inputs in Audit Trail**</span>
    *   **Problem:** In `AuditTrail.tsx`, if a user types quickly into the filter input, it might trigger a new network request for every single keystroke, which is inefficient.
    *   **Suggestion:** "Debounce" the input. This means waiting until the user has stopped typing for a brief period (e.g., 300ms) before sending the API request.
    *   **Implementation:**
        *   **`[TODO: Frontend]`** In `AuditTrail.tsx`, wrap the `fetchLogs` call inside a `debounce` function (from a library like `lodash-es`) or a custom `useDebounce` hook.

#### **3. Backend & Architectural Improvements**

*   <span style="color:red;">**Consolidate All API Calls into `useDatabase`**</span>
    *   **Problem:** The components `MemberManagement`, `SnapshotManagement`, and `AuditTrail` bypass the `useDatabase` hook and make direct `supabase.functions.invoke()` calls themselves. This decentralizes the data-access logic and makes it harder to manage.
    *   **Suggestion:** All data-fetching and mutation logic should be encapsulated within the `useDatabase` hook.
    *   **Implementation:**
        *   **`[TODO: Frontend]`** Move the `fetchMembers`, `inviteMember`, `handleRemoveMember`, etc., functions from the components into `useDatabase.ts`. The components would then call these functions from the hook, just like `ProjectsList` does. This makes the components purely responsible for UI and state, and centralizes all asynchronous logic in one place.


Yes, absolutely. The "Excel View" is the core of your application's user experience, and there are several significant improvements that could be made to elevate it from a good spreadsheet tool to a great one. The improvements fall into three categories: features, performance, and architecture.

---

### **Recommendations for Improvemen EXCEL DETAILSt**

#### **1. User Experience (UX) & Core Spreadsheet Features**

These are the features that users will most directly notice and appreciate, bringing the application closer to the power and fluidity of desktop spreadsheet software.

*   <span style="color:orange;">**Implement Keyboard Navigation & Shortcuts**</span>
    *   **Problem:** Power users of Excel and Google Sheets rely heavily on the keyboard. The current implementation is mouse-driven. The inability to navigate with arrow keys, edit with `F2`, or save with `Ctrl+S` will feel clunky to experienced users.
    *   **Suggestion:** Leverage AG Grid's keyboard navigation features. Enable arrow key navigation between cells, allow editing to be initiated with the `Enter` or `F2` key, and capture common keyboard shortcuts.
    *   **Implementation:**
        *   **`[TODO: Frontend]`** In `SheetDetail.tsx`, configure the AG Grid properties to enable keyboard navigation. Add event listeners to the grid component to capture keydown events (`onGridKeyDown`). You could map `Ctrl+C` / `Ctrl+V` to a custom copy/paste handler, and `Ctrl+S` to trigger the save status indicator.

*   <span style="color:orange;">**Add Column and Row Manipulation (Drag & Drop, Resize)**</span>
    *   **Problem:** The current layout is static. Users cannot reorder columns or resize them to fit their content, which is a fundamental spreadsheet operation.
    *   **Suggestion:** Enable column drag-and-drop reordering and resizing directly in the grid's header. Add a context menu to rows and columns for inserting or deleting them.
    *   **Implementation:**
        *   **`[TODO: Frontend]`** In `SheetDetail.tsx`:
            *   Enable AG Grid's `suppressMovableColumns={false}` and `resizable={true}` properties.
            *   Implement the `onColumnMoved` event listener to save the new column order to the `position` field in your `columns` table.
            *   Add a context menu (`getContextMenuItems` AG Grid prop) to the grid cells that provides "Insert row above," "Insert row below," and "Delete row" options. These would call the appropriate `useDatabase` functions.

*   <span style="color:orange;">**Implement Client-Side Formula Calculations**</span>
    *   **Problem:** The `FormulaBar` and `FormattingContext` suggest a formula system is planned, but there's no visible client-side engine to calculate formulas in real-time. Without this, formulas are just static text.
    *   **Suggestion:** Integrate a lightweight JavaScript formula parsing library (like `hyperformula` or `hot-formula-parser`). When a cell value changes, this engine could recalculate any dependent formula cells instantly on the client-side, providing immediate feedback.
    *   **Implementation:**
        *   **`[TODO: Frontend]`** In `SheetDetail.tsx`, on `handleCellValueChanged`, after a value is saved, you would update the formula engine with the new value. Then, you would iterate through all cells that contain formulas and ask the engine to recalculate them, updating the grid data accordingly. The formula itself (`=SUM(...)`) would be stored in a separate field in your `row_data` JSONB, distinct from the calculated value.

#### **2. Performance Optimization**

As the amount of data grows, these changes will be critical to keeping the application fast and responsive.

*   <span style="color:red;">**Enable AG Grid's Row and Column Virtualization**</span>
    *   **Problem:** In `SheetDetail.tsx`, the grid is configured with `suppressColumnVirtualisation={false}` and `suppressRowVirtualisation={false}`. This means that if a sheet has 10,000 rows and 50 columns, the browser is attempting to render **all 500,000 cells** as HTML elements at once. This will cause severe performance degradation and will eventually crash the browser.
    *   **Suggestion:** **This is the most critical performance fix.** Remove these suppression flags. AG Grid's core feature is **virtualization**, which means it only renders the cells that are currently visible in the viewport. As the user scrolls, it intelligently recycles the existing HTML elements and populates them with new data, keeping the DOM incredibly small and fast.
    *   **Implementation:**
        *   **`[TODO: Frontend]`** In `SheetDetail.tsx`, within the `<AgGridReact>` component's props, **remove** the lines `suppressColumnVirtualisation={false}` and `suppressRowVirtualisation={false}`. AG Grid enables virtualization by default, so removing these overrides will fix the issue.

*   <span style="color:orange;">**Paginate Data Loading for Large Sheets**</span>
    *   **Problem:** The `fetchRows` function currently loads all rows for a sheet in a single request. A sheet with 100,000 rows would result in a massive data transfer and a long initial load time.
    *   **Suggestion:** Implement server-side pagination with infinite scroll in the grid.
    *   **Implementation:**
        *   **`[TODO: Frontend]`** Configure AG Grid's "Infinite Row Model". This involves setting `rowModelType = 'infinite'` and providing an `onGridReady` callback that creates a datasource object. This datasource will have a `getRows` method that calls `fetchRows` from `useDatabase`.
        *   **`[TODO: Backend]`** The `fetchRows` function in `useDatabase.ts` must be modified to accept `startRow` and `endRow` parameters. It would then use Supabase's `.range(startRow, endRow)` modifier to fetch only the required chunk of data from the database.

#### **3. Backend & Architectural Improvements**

*   <span style="color:red;">**Refactor Data Saving to a Bulk Update Backend Function**</span>
    *   **Problem:** The current `handleCellValueChanged` function sends one `updateRow` request to the backend for every single cell edit. If a user quickly edits 10 cells, it fires 10 separate network requests. This is inefficient ("chatty") and doesn't scale well.
    *   **Suggestion:** Implement a "unit of work" or "debounced save" pattern. Collect all cell changes made within a short time frame (e.g., 2 seconds) and send them to the backend in a single, bulk request.
    *   **Implementation:**
        *   **`[TODO: Backend]`** Create a new Deno Edge Function called `bulk-update-rows`. This function would accept an array of objects, each containing a `rowId` and the `updatedData`. It would then loop through these and perform the updates on the server-side.
        *   **`[TODO: Frontend]`** In `SheetDetail.tsx`, `handleCellValueChanged` would no longer call `updateRow` directly. Instead, it would add the change to a "dirty changes" queue in the component's state. A debounced function would then periodically take all changes from the queue and send them in a single call to the new `bulk-update-rows` function. The "Saving..." indicator would be shown until this bulk save is complete.

You've correctly identified that while the high-level "Excel View" improvements are important, the `SheetDetail.tsx` component itself is where the most impactful and technical changes can be made. It's the engine of the entire spreadsheet experience.

Let's focus specifically on improvements for the `SheetDetail.tsx` component.

---

### **Recommendations for `SheetDetail.tsx` Improvement**

#### **1. Critical Performance Optimizations**

These are the most important changes to ensure the component can handle large datasets and feels responsive.

*   <span style="color:red;">**Enable Row and Column Virtualization (Highest Priority)**</span>
    *   **Problem:** The grid is currently configured with `suppressColumnVirtualisation={false}` and `suppressRowVirtualisation={false}`. This forces AG Grid to render every single cell as a DOM element, which will lead to severe performance issues and browser crashes on sheets with more than a few thousand cells.
    *   **Suggestion:** Remove these suppression flags immediately. AG Grid's core strength is virtualization—only rendering the visible portion of the grid. This is the single most important performance fix.
    *   **Implementation:**
        *   **`[TODO: Frontend]`** In the `<AgGridReact>` props within `SheetDetail.tsx`, **delete** the `suppressColumnVirtualisation={false}` and `suppressRowVirtualisation={false}` lines.

*   <span style="color:red;">**Implement a Bulk Update Strategy for Saving**</span>
    *   **Problem:** The `handleCellValueChanged` function sends a separate network request to the backend for every single cell edit. This is inefficient and can overwhelm the network, especially during paste operations.
    *   **Suggestion:** Implement a "debounced bulk save" mechanism. Collect all changes made by the user in a short timeframe and send them to the backend in a single API call.
    *   **Implementation:**
        *   **`[TODO: Backend]`** Create a new Deno Edge Function, `bulk-update-rows`, that accepts an array of `[{ rowId, updatedData }]` objects.
        *   **`[TODO: Frontend]`** In `SheetDetail.tsx`:
            1.  Create a new state variable: `const [dirtyChanges, setDirtyChanges] = useState({})`.
            2.  In `handleCellValueChanged`, instead of calling `updateRow`, add the change to the `dirtyChanges` object: `setDirtyChanges(prev => ({...prev, [rowId]: updatedRowData}))`.
            3.  Create a `useDebouncedEffect` hook (or use a library) that triggers 2 seconds after `dirtyChanges` is modified. This effect will call the new `bulk-update-rows` function with the collected changes and then clear the `dirtyChanges` state. The "Saving..." indicator would be tied to this process.

#### **2. Core Functionality Enhancements**

These features will make the spreadsheet feel more powerful and complete.

*   <span style="color:orange;">**Implement Copy and Paste Functionality**</span>
    *   **Problem:** Users cannot copy and paste data, which is a fundamental expectation of any spreadsheet.
    *   **Suggestion:** Use AG Grid's built-in clipboard functionality and extend it to handle bulk updates.
    *   **Implementation:**
        *   **`[TODO: Frontend]`** In `SheetDetail.tsx`:
            1.  Enable AG Grid's clipboard props: `enableRangeSelection={true}` and `enableCellTextSelection={true}`.
            2.  Implement the `onPasteEnd` grid event. This event provides all the data that was pasted. You would loop through the pasted cells, collect them as a set of changes, and send them to the (newly created) `bulk-update-rows` backend function.

*   <span style="color:orange;">**Add Full Row Deletion with Dependency Checks**</span>
    *   **Problem:** The `handleDeleteSelectedRows` function exists, but it needs to be robustly implemented and connected to the UI. The dependency check logic (`validateRowBeforeDeletion`) is present in the `useDatabase` hook but needs to be fully utilized.
    *   **Suggestion:** Add a context menu to the row numbers that allows for deleting one or more rows.
    *   **Implementation:**
        *   **`[TODO: Frontend]`** In `SheetDetail.tsx`:
            1.  Use the `getContextMenuItems` AG Grid prop to add a "Delete Row(s)" option to the context menu.
            2.  When clicked, the `handleDeleteSelectedRows` function should first call `validateRowBeforeDeletion` for each selected row.
            3.  If any row has dependencies, it must open the `DeleteDependenciesDialog` to warn the user.
            4.  If there are no dependencies (or the user chooses to delete anyway), it should call a new `bulk-delete-rows` backend function.

*   <span style="color:orange;">**Implement Client-Side Formula Engine**</span>
    *   **Problem:** Formulas are a key part of the "Excel experience," but the current implementation lacks a real-time calculation engine on the client.
    *   **Suggestion:** Integrate a formula parser to provide instant feedback as data changes.
    *   **Implementation:**
        *   **`[TODO: Frontend]`** In `SheetDetail.tsx`:
            1.  When `loadData` runs, initialize a formula parser instance with the data.
            2.  Store formulas separately from values in your `rowData` state (e.g., each cell object could be `{ value: 100, formula: '=B2*C2' }`).
            3.  When a cell value changes in `handleCellValueChanged`, after the data is saved, update the formula parser with the new value. The parser will return a list of all cells that need to be recalculated.
            4.  Loop through the results from the parser and update the `rowData` state with the new calculated values, causing the grid to refresh.

#### **3. Architectural & Code Quality Improvements**

These changes will make the component more maintainable and robust.

*   <span style="color:red;">**Separate Grid Configuration from Component Logic**</span>
    *   **Problem:** The `setupGridData` function, which contains all the complex AG Grid `ColDef` configuration, is inside the main `SheetDetailInner` component. This makes the component very large and mixes configuration with state management and event handling logic.
    *   **Suggestion:** Move the AG Grid configuration into a separate file or a dedicated hook.
    *   **Implementation:**
        *   **`[TODO: Frontend]`** Create a new file, e.g., `src/config/gridConfig.ts`. Create a function within it called `generateColumnDefs(columns, selectOptions, ...)` that takes the necessary data and returns the `ColDef[]` array. The `SheetDetail.tsx` component would then simply call this function, making the main component code much cleaner and easier to read.

*   <span style="color:orange;">**Refactor Real-time Subscription Logic**</span>
    *   **Problem:** The current real-time subscription in the `useEffect` hook triggers a full `loadData()` call. This is simple but inefficient, as it re-fetches all columns and rows even if only one cell changed.
    *   **Suggestion:** Make the real-time updates more granular.
    *   **Implementation:**
        *   **`[TODO: Frontend]`** When the Supabase channel receives a payload, instead of calling `loadData()`, inspect the payload. If it's an `UPDATE`, get the `rowId` and the new `row_data` from the payload. Use the AG Grid API (`gridRef.current.api.getRowNode(rowId).setData(newData)`) to update only the specific row that changed in the grid. This will be significantly faster and smoother for users.


### **New Feature Plan: Project-Aware AI Assistant**

*   **Goal:** To implement a collapsible chat interface within the "Excel View" where users can ask natural language questions about their current project. The AI should have access to the project's schema and potentially its data to provide intelligent, context-aware answers.
*   **User Experience:** A small chat icon or button, perhaps in the bottom-right corner of the `ExcelTableDetail` view. Clicking it opens a chat panel where the user can type questions like:
    *   "How many tables are in this project?"
    *   "What columns are in the 'Tasks' table?"
    *   "Show me all tasks assigned to 'John Doe'."
    *   "What is the average value in the 'Amount' column of the 'Expenses' table?"

---

### **Implementation Plan**

This is a significant feature that requires new components on both the frontend and backend.

#### **1. Backend Implementation (`[TODO: Backend]`)**

A new, dedicated Deno Edge Function is the best approach for this. It will act as the "brain" for the assistant.

*   **Create a New Edge Function: `project-assistant`**
    *   **File:** `/supabase/functions/project-assistant/index.ts`
    *   **Purpose:** To receive a user's question and the `projectId`, gather the necessary context, construct a detailed prompt for the AI model (like Gemini), and stream the response back to the user.

*   **Detailed Logic for the `project-assistant` Function:**
    1.  **Request Body:** It should accept a POST request with `{ projectId: string, conversationHistory: [], userQuery: string }`.
    2.  **Authentication & Authorization:** It must first verify the user's JWT and then call the `check-permissions` function to ensure the user has at least `view` permission for the given `projectId`. This is a critical security step to prevent data leaks.
    3.  **Context Gathering (The "Magic"):** This is the most important step. Before calling the AI, the function needs to gather context about the project. It should perform several database queries:
        *   Fetch all tables in the project (`SELECT name, description FROM better_tables WHERE project_id = ...`).
        *   For each table, fetch its columns (`SELECT name, data_type FROM columns WHERE sheet_id IN (...)`).
        *   This gathered schema information (table names, column names, data types) is the **primary context**.
    4.  **Prompt Engineering:** The function will then construct a sophisticated "meta-prompt" for the Gemini API. This prompt will not just contain the user's question but also all the gathered context. It would look something like this:

        ```
        System Prompt: You are a helpful assistant for the 'Better Excel' application. 
        Your task is to answer user questions based on the provided database schema. 
        If the question requires querying data, formulate a SQL query that can be run against the database. 
        Respond in a helpful, conversational tone.

        Database Schema Context for Project '{projectId}':
        - Table: 'Tasks' (Columns: 'Task Name' (text), 'Assignee' (text), 'Due Date' (date), 'Status' (text))
        - Table: 'Expenses' (Columns: 'Item' (text), 'Amount' (number), 'Category' (text))
        
        Conversation History:
        - User: "How many tasks are there?"
        - You: "To find out, I can run a query. Would you like me to proceed?"
        
        Current User Question:
        "{userQuery}"
        ```

    5.  **AI Interaction (Two-Step "Agent" Approach):** For complex questions that require data, a simple Q&A is not enough. An "agentic" approach is much more powerful:
        *   **Step 1 - Plan Generation:** The first call to Gemini asks it to determine the user's *intent*. Does the question just need the schema, or does it require running a query? If it needs a query, the AI's job is to **generate a safe SQL query**.
        *   **Step 2 - Query Execution:** The Deno function receives the SQL query from Gemini. It performs a sanity check (e.g., ensuring it's a `SELECT` statement and doesn't contain dangerous commands). It then **executes the SQL query against the database** using the Supabase admin client.
        *   **Step 3 - Final Response Generation:** The Deno function makes a *second* call to Gemini. This time, it provides the original question, the SQL query it ran, and the **data result from that query**. The prompt is now: "Given this question and this data, formulate a friendly, human-readable answer."
    6.  **Streaming Response:** The function should stream the final response from Gemini back to the frontend, allowing the user to see the answer appear token by token, creating a classic chatbot experience.


### **New Feature Plan: Project-Aware AI Assistant (Front end)**

*   **Goal:** To implement a collapsible chat interface **within the main spreadsheet view (`ExcelTableDetail`)** where users can ask natural language questions about their current project.
*   **Location:** The chat interface should be accessible from the header or as a floating button over the spreadsheet grid, not on the project dashboard page.

---

### **Revised Frontend Implementation Plan (`[TODO: Frontend]`)**

The backend implementation plan for the `project-assistant` Deno Edge Function remains **exactly the same**. The change is purely on the frontend, focusing on where and how the chat component is rendered.

#### **1. Create the Core Chat Component**

*   **Create a `ProjectAssistantChat.tsx` Component**
    *   **File:** `src/components/ProjectAssistantChat.tsx`
    *   **UI:** This is the self-contained chat box. It will have:
        *   A header with a title like "Project Assistant" and a "Collapse" button.
        *   A scrollable message history area.
        *   A text input for the user's question.
    *   **Logic:** It will use the `useProjectAssistant` hook (detailed below) to manage the conversation state and send messages.

#### **2. Create the Data Logic Hook**

*   **Create a `useProjectAssistant.ts` Hook**
    *   **File:** `src/hooks/useProjectAssistant.ts`
    *   **Purpose:** To handle all communication with the backend.
    *   **Functions:**
        *   `sendMessage(projectId, conversationHistory, userQuery)`: This will invoke the `project-assistant` Edge Function and handle the streaming response to update the chat history in real-time.

#### **3. Integrate into the Excel View**

This is the key change. We will integrate the chat assistant directly into the `ExcelTableDetail.tsx` component.

*   **Modify `ExcelTableDetail.tsx`**
    *   **State Management:** Add a new state variable to control the visibility of the chat panel:
        ```typescript
        const [isChatOpen, setIsChatOpen] = useState(false);
        ```
    *   **UI Change 1 - The Trigger Button:** In the header area of the `ExcelTableDetailInner` component, next to the "Table Settings" button, add a new button to open the chat.
        ```typescript
        // In ExcelTableDetail.tsx's header div
        <Button 
          variant="outline"
          size="sm"
          onClick={() => setIsChatOpen(true)}
          className="flex items-center gap-2"
        >
          <Sparkles className="h-4 w-4" />
          AI Assistant
        </Button>
        ```
    *   **UI Change 2 - Render the Chat Panel:** At the bottom of the `ExcelTableDetailInner` component's main `div`, conditionally render the chat component. It should be rendered as a floating panel.
        ```typescript
        // At the end of the main div in ExcelTableDetailInner
        {isChatOpen && (
          <div className="absolute bottom-4 right-4 z-50">
            <ProjectAssistantChat 
              projectId={projectId!} 
              onClose={() => setIsChatOpen(false)} 
            />
          </div>
        )}
        ```


---

### <span style="color:orange;">**1. Table-Level Access Permissions**</span>

*   **Goal:** To allow a project owner or admin to control which roles can see or edit specific tables within a project. For example, the "Management" team can see the 'Financials' table, but the "Marketing" team cannot.
*   **Current Status:** Permissions are currently project-wide. If a user is an Editor on a project, they are an Editor on *all* tables within it.

#### **Implementation Plan**

1.  **Database (`[TODO: Backend]`)**
    *   **Create a `table_permissions` Table:** This new table will store role-based permissions for each table.
        *   `id` (uuid, Primary Key)
        *   `table_id` (uuid, Foreign Key to `better_tables`)
        *   `role` (text, e.g., `'owner'`, `'admin'`, `'editor'`, `'viewer'`)
        *   `permission_level` (text, e.g., `'can_view'`, `'can_edit'`, `'no_access'`)
    *   **Default Behavior:** When a new table is created, it should inherit the project's default permissions. This can be handled by a trigger or the `createTable` function.

2.  **Backend (`[TODO: Backend]`)**
    *   **Modify the `check-permissions` Deno Edge Function:** This function needs to become more sophisticated.
        *   When a permission check is requested that involves a specific table (e.g., `edit_data_in_table`), it must first check the `table_permissions` table.
        *   If an explicit rule exists for the user's role on that table, that rule takes precedence.
        *   If no rule exists, it should fall back to the user's project-level role from the `project_members` table.
    *   **Modify `fetchTables` Logic:** The `fetchTables` function (likely moved to a backend function as previously recommended) must be updated. It should join with the `table_permissions` table and only return tables where the user's role has at least `'can_view'` access.

3.  **Frontend (`[TODO: Frontend]`)**
    *   **Create a `TableSettingsModal.tsx` Component (or enhance the existing one):**
        *   Add a new "Permissions" tab to this modal.
        *   This tab will display a list of project roles (`owner`, `admin`, etc.).
        *   Next to each role, there will be a dropdown allowing the admin to set the permission for that table: `No Access`, `Can View`, `Can Edit`.
        *   Saving these settings will insert or update records in the new `table_permissions` table.
    *   **Modify `LeftSidebar.tsx`:** The query that populates the list of tables in the sidebar must now use the updated `fetchTables` logic, so users will only see the tables they have access to.

---

### <span style="color:orange;">**2. Column-Level Access Permissions (Field-Level Security)**</span>

*   **Goal:** To provide the most granular level of control, allowing admins to set permissions on a per-column basis. This is essential for sensitive data.
*   **Examples:**
    *   Everyone can see the 'Tasks' table, but only 'Admins' can see the 'Budget' column.
    *   'Editors' can edit most fields, but the 'Final Approval' checkbox is read-only for them and can only be changed by an 'Admin'.

#### **Implementation Plan**

1.  **Database (`[TODO: Backend]`)**
    *   **Create a `column_permissions` Table:**
        *   `id` (uuid, Primary Key)
        *   `column_id` (uuid, Foreign Key to `columns`)
        *   `role` (text)
        *   `can_view` (boolean, `DEFAULT true`)
        *   `can_edit` (boolean, `DEFAULT true`)

2.  **Backend (`[TODO: Backend]`)**
    *   **Modify `fetchColumns` Logic:** This is a critical change. The function that returns the list of columns for a sheet **must** be a backend Deno function to be secure.
        *   The new `get-columns-for-sheet` function will receive a `sheetId`.
        *   It will first get the user's role for the project.
        *   It will then query the `columns` table and join it with the new `column_permissions` table.
        *   It will filter the results based on the user's role, only returning columns where `can_view` is `true` for that role.
        *   It should also include the `can_edit` permission in the data it returns for each column, so the frontend knows whether to make the cells in that column read-only.
    *   **Modify `updateRow` and `createRow` Backend Functions:** These functions must be enhanced. Before saving data, they need to perform a server-side check. For each key in the `row_data` to be saved, they must check the `column_permissions` table to ensure the user has `can_edit` permission for that specific column. If not, that part of the update should be rejected.

3.  **Frontend (`[TODO: Frontend]`)**
    *   **Modify `ColumnCreationDialog.tsx`:**
        *   Add a new "Permissions" tab to the dialog.
        *   This tab will list the project roles (`owner`, `admin`, etc.).
        *   Next to each role, there will be two checkboxes: `Can View` and `Can Edit`.
        *   Saving these settings will create or update records in the `column_permissions` table.
    *   **Modify `SheetDetail.tsx`:**
        *   The component will now fetch its columns from the new secure `get-columns-for-sheet` backend function. This means it will automatically only receive the columns the user is allowed to see.
        *   In the `setupGridData` function, when creating the `ColDef` for each column, it will check the `can_edit` property returned from the backend. If `can_edit` is `false`, it will set the `editable` property of the `ColDef` to `false`, making the entire column read-only in the UI.

---

### **Frontend Reform Plan: The Forms Feature**

#### **1. Architectural & Code Quality Improvements**

These are foundational changes to make the code more maintainable and align it with best practices.

*   <span style="color:red;">**Refactor from a "State Machine" to a Routed Feature**</span>
    *   **Problem:** `FormsList.tsx` currently manages four different views (list, creator, settings, submissions) within one component. This makes the file large, hard to manage, and prevents users from bookmarking or directly navigating to a specific form's settings or submission page.
    *   **Suggestion:** Split the component into separate, routable pages. This is a more standard and scalable approach for single-page applications.
    *   **Implementation:**
        *   **`[TODO: Frontend]`** **Modify `App.tsx` Routing:** Introduce nested routes for the forms feature.
            ```typescript
            // In App.tsx
            <Route path="/project/:projectId/forms" element={<FormsListPage />} />
            <Route path="/project/:projectId/forms/new" element={<FormCreatorPage />} />
            <Route path="/project/:projectId/forms/:formId/manage" element={<FormManagementPage />} />
            <Route path="/project/:projectId/forms/:formId/settings" element={<FormSettingsPage />} />
            ```
        *   **`[TODO: Frontend]`** **Split Components:**
            *   Rename `FormsList.tsx` to `FormsListPage.tsx`. Its only job will be to list the forms.
            *   Create a new page component, e.g., `FormCreatorPage.tsx`, that renders the `<FormCreator />` component.
            *   Do the same for `FormManagementPage.tsx` and `FormSettingsPage.tsx`. This separates the concerns, making each component smaller and more focused.

*   <span style="color:red;">**Centralize All Data Logic into `useDatabase`**</span>
    *   **Problem:** `FormsList.tsx` makes direct `supabase.from(...).select(...)` and `supabase.functions.invoke(...)` calls. This decentralizes the application's data access patterns.
    *   **Suggestion:** Move all form-related data logic into the `useDatabase.ts` hook to maintain a consistent architecture.
    *   **Implementation:**
        *   **`[TODO: Frontend]`** In `useDatabase.ts`, create new functions:
            *   `fetchForms(projectId)`
            *   `deleteForm(formId)`
            *   `duplicateForm(form)`
            *   `getFormShareUrl(formId)`
        *   The components (`FormsListPage`, etc.) will then call these functions from the hook instead of making direct Supabase calls.

#### **2. User Experience (UX) & Feature Enhancements**

*   <span style="color:orange;">**Implement Form Editing**</span>
    *   **Problem:** There is currently no way to edit a form after it has been created. This is a critical missing feature.
    *   **Suggestion:** Enhance the `FormCreator` component to operate in an "edit mode."
    *   **Implementation:**
        *   **`[TODO: Frontend]`** The `FormCreator` component should accept an optional `formId` prop.
        *   If `formId` is present, the component will first fetch the existing form's data (name, description, questions, settings) and populate the form with those values.
        *   The "Save" button's logic will change: instead of calling a `forms-create` function, it will call a `forms-update` function in the backend, sending the `formId` along with the updated data.

*   <span style="color:orange;">**Convert Creation and Settings to Modals**</span>
    *   **Problem:** Switching the entire view just to create a new form or change a setting can be a jarring experience for the user, as they lose the context of the main list.
    *   **Suggestion:** Use modal dialogs for shorter, focused tasks like creation and settings.
    *   **Implementation:**
        *   **`[TODO: Frontend]`** Instead of navigating to a new page, the "Create Form" button on the `FormsListPage` would open the `<FormCreator />` component inside a large modal (`Dialog`).
        *   Similarly, the "Settings" button on a form card would open the `<EnhancedFormSettings />` component inside a modal, keeping the main list visible in the background. (The "Manage Submissions" view is complex enough to warrant being its own page).

*   <span style="color:orange;">**Implement a Stable, Persistent Share URL**</span>
    *   **Problem:** The current `shareForm` function appears to generate a *new* public token every time the share button is clicked. This is not ideal; a form should have one stable public URL that can be shared permanently.
    *   **Suggestion:** Store the public token in the database and create a dedicated sharing dialog.
    *   **Implementation:**
        *   **`[TODO: Backend]`** **Modify `forms` Table:** Add a new column `public_url_token` (`text`, `nullable`, `unique`).
        *   **`[TODO: Backend]`** Create a new `forms-share` Edge Function. When called for a form, it checks if a `public_url_token` already exists. If not, it generates one and saves it. It then returns the full public URL.
        *   **`[TODO: Frontend]`** Create the `FormSharingDialog.tsx` component (from your original file list). When the user clicks the "Share" button, this dialog opens. It calls the `forms-share` function to get the URL and then displays it for the user to copy. It could also include other options, like an on/off toggle for public access.



---

### **Architectural Improvement Plan: Integrating Forms into Projects**

*   **Goal:** To formally link every Form to a Project, making Projects the definitive container for all application resources (Tables and Forms).
*   **Current State:** The `forms` table has a `project_id` column, but it is `nullable`. The `FormsList.tsx` component correctly filters forms by the `projectId` from the URL, so the application *behaves* as though forms are in projects, but the database schema does not strictly enforce this rule.
*   **Problem:** The current nullable schema could potentially lead to "orphaned" forms that don't belong to any project, making them inaccessible from the main UI.

---

### <span style="color:red;">**Implementation Plan (Future Update)**</span>

This is a multi-step process that involves a database migration and updates to both the backend and frontend.

#### **1. Database & Backend Changes (`[TODO: Backend]`)**

1.  **Database Migration:** The most critical step is to alter the database schema.
    *   **Step 1a (Data Cleanup):** Run an update script to assign a `project_id` to any existing forms where it is currently `NULL`.
    *   **Step 1b (Alter Table):** Run an `ALTER TABLE` command to change the `project_id` column to be `NOT NULL`.
        ```sql
        -- SQL for database migration
        ALTER TABLE public.forms
        ALTER COLUMN project_id SET NOT NULL;
        ```
    *   **Step 1c (Add Foreign Key):** Add a formal foreign key constraint to ensure data integrity.
        ```sql
        ALTER TABLE public.forms
        ADD CONSTRAINT forms_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
        ```
        Adding `ON DELETE CASCADE` is a major improvement. It means that if a Project is deleted, all of its associated Forms will be automatically deleted as well, preventing orphaned data.

2.  **Modify Backend Functions:**
    *   **Update `forms-create` Function:** The Deno function responsible for creating new forms must be modified. The `project_id` parameter, which is currently optional, must now be treated as **mandatory**. The function should throw an error if a `project_id` is not provided.
    *   **Update Security Rules:** All `forms-*` functions should begin by checking if the authenticated user has at least `view` permission on the provided `project_id`. This links form security directly to the project's RBAC system.

#### **2. Frontend Changes (`[TODO: Frontend]`)**

1.  **Modify `FormCreator.tsx`:**
    *   The `FormCreator` component already receives a `projectId` as a prop. The change here is to ensure that this `projectId` is **always** included in the payload sent to the `forms-create` backend function.

2.  **Review `FormsList.tsx`:**
    *   No changes are likely needed here, as this component is already operating correctly by filtering forms based on the `projectId` from the URL. The backend changes will simply make this behavior more robust and secure.


Of course. Adding import/export functionality is a critical feature for any spreadsheet application, as it allows users to bring data in from other sources and take their data out for use in other tools. Focusing on the sheet level is the right approach.

Let's scope out the implementation plan for robust upload (import) and download (export) features for a single sheet.

---

### **New Feature Plan: Sheet Import / Export**

*   **Goal:** To provide users with the ability to download the data from a single sheet as a CSV file, and to upload a CSV file to either create a new sheet or add data to an existing one.
*   **Location:** The triggers for these actions should be located in the `ExcelToolbar.tsx` or a "File" menu within the main spreadsheet view.

---

### **1. Download (Export to CSV) Feature**

This feature is simpler and can be handled almost entirely on the frontend.

#### **Implementation Plan (`[TODO: Frontend]`)**

1.  **Create a `CSVExportService.ts` Utility**
    *   **File:** `src/lib/csvExportService.ts`
    *   **Purpose:** To encapsulate the logic for converting the grid's data into a CSV string.
    *   **Function:** `exportGridDataToCSV(columns, rows)`:
        1.  It will take the `columns` and `rows` arrays from `SheetDetail.tsx` as input.
        2.  **Header Row:** It will generate the first line of the CSV by joining the `column.name` properties with commas.
        3.  **Data Rows:** It will iterate through the `rows` array. For each row, it will iterate through the `columns` array (to maintain the correct order) and pull the corresponding value from the `row.row_data` object.
        4.  **Formatting:** It must handle cases where the data itself contains commas or quotation marks by properly enclosing the cell content in quotes (e.g., `"Value, with comma"`).
        5.  **Return:** It will return the complete, multi-line CSV string.

2.  **Modify `ExcelToolbar.tsx`**
    *   **UI Change:** Add a "File" dropdown menu or a dedicated "Export" button to the toolbar.
    *   **Event Trigger:** Clicking "Export to CSV" should trigger a custom event or call a function passed down via props.

3.  **Modify `SheetDetail.tsx`**
    *   **Event Listener:** The component will listen for the "Export" event from the toolbar.
    *   **Handler Logic (`handleExport`):**
        1.  When the event is triggered, it will call the `exportGridDataToCSV(columns, rows)` service, passing its current `columns` and `rows` state.
        2.  It will take the returned CSV string.
        3.  **Trigger Download:** It will create a `Blob` object from the string, generate a temporary URL for it using `URL.createObjectURL()`, create a hidden `<a>` element with the URL and a `download="sheet-name.csv"` attribute, and programmatically click it to initiate the file download in the user's browser.

---

### **2. Upload (Import from CSV) Feature**

This is a much more complex feature that requires a robust backend function to handle parsing, validation, and bulk data insertion.

#### **Implementation Plan**

1.  **Backend (`[TODO: Backend]`)**
    *   **Create a `sheet-import-csv` Deno Edge Function:** This function will be the engine for the import process. It needs to be a streaming function to handle potentially large files without timing out.
    *   **Function Logic:**
        1.  **Request:** It will accept a `multipart/form-data` request containing the CSV file, the `sheetId` to import into, and an `importMode` (`'append'` or `'overwrite'`).
        2.  **Security:** It must verify the user's JWT and use the `check-permissions` function to ensure the user has `edit_data` permission for the project.
        3.  **CSV Parsing:** It will stream the uploaded file and parse it using a robust CSV parsing library (like `papaparse` for Deno).
        4.  **Header Mapping:** It will read the header row from the CSV. It then needs to intelligently map the column names from the CSV to the existing `column.id`s in the target sheet. It should be flexible, matching "First Name" in the CSV to the `name: 'First Name'` column in the database.
        5.  **Data Validation:** For each row in the CSV, it must perform validation against the target column's properties (e.g., ensuring a 'number' column receives a valid number).
        6.  **Bulk Insertion:** It will collect validated rows into batches (e.g., 100 rows at a time). For each batch, it will perform a bulk `INSERT` into the `rows` table. Using `supabase.from('rows').insert([...])` is highly efficient for this.
        7.  **Response:** It will return a summary of the import, such as `{ "success": true, "rowsImported": 500, "rowsSkipped": 5, "errors": [...] }`.

2.  **Frontend (`[TODO: Frontend]`)**
    *   **Create an `ImportDialog.tsx` Component**
        *   **UI:** This dialog will contain:
            *   A file input (`<input type="file" accept=".csv" />`).
            *   A dropdown to select the `importMode`: "Append to existing rows" or "Overwrite all existing rows".
            *   A "Start Import" button.
            *   A progress/status area to show the results returned from the backend.
        *   **Logic (`handleImport`):**
            1.  When the user clicks "Start Import," it will create a `FormData` object.
            2.  It will append the selected file, the `sheetId`, and the `importMode`.
            3.  It will call a new `importSheetCSV` function in the `useDatabase` hook.

    *   **Modify `ExcelToolbar.tsx`**
        *   **UI Change:** Add an "Import from CSV" option to the "File" menu.
        *   **Logic:** This button will open the new `ImportDialog.tsx`.

    *   **Modify `useDatabase.ts`**
        *   **New Function:** Create a new `importSheetCSV(formData)` function.
        *   This function will be a wrapper for `supabase.functions.invoke('sheet-import-csv', { body: formData })`. It will handle showing initial "Importing..." toasts and displaying the final success or error summary returned by the backend function.

This approach provides a secure, robust, and user-friendly way to handle data import/export, which is a critical feature for making the application a truly useful data tool.