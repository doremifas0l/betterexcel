---
## **Comprehensive Backend & Database Architecture Documentation**

### **1. Architectural Philosophy: The Database as the Brain**

This application's backend is built on a **database-centric** philosophy. Instead of placing all business logic in application code (like Deno Edge Functions), it leverages the full power of PostgreSQL to handle complex operations, enforce data integrity, and trigger calculations automatically.

This design choice has several key advantages:
*   **Data Integrity:** Business rules (e.g., "a rollup must update when its source data changes," "a role must be one of five specific values") are enforced at the data layer, making them unavoidable and consistent across the entire application.
*   **Performance:** Executing logic within the database through compiled functions and triggers is often faster than multiple round-trips between an application server and the database, especially for complex data manipulations.
*   **Atomicity:** Complex operations that involve multiple steps can be wrapped in transactions, ensuring that data is never left in a partially updated, inconsistent state.

The core technologies enabling this are:
*   **PostgreSQL Functions:** Reusable blocks of SQL and PL/pgSQL code that encapsulate complex logic (e.g., `calculate_rollup_value`).
*   **Database Triggers:** Procedures that automatically execute in response to data modification events (`INSERT`, `UPDATE`, `DELETE`), forming the backbone of the auditing and rollup systems.
*   **JSONB Data Type:** A highly efficient binary JSON format that allows for storing flexible, schema-less data within a structured relational database. This provides the perfect blend of flexibility for user-defined tables and the power of relational integrity.

---

### **2. Core Data Model & Schema Deep Dive**

The data model is organized into three logical categories: the data hierarchy itself, configuration tables that define feature behavior, and system tables that manage security and auditing.

#### **2.1. Data Hierarchy Tables**

These tables form the core structure that users interact with.

##### **`projects`**
The top-level container for all user-created content.

| Column | Data Type | Description & Purpose | Dependencies & Constraints |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | The unique identifier for the project. | **Primary Key** |
| `user_id` | `uuid` | Identifies the original creator/owner of the project. | Foreign Key -> `auth.users(id)` |
| `name` | `text` | The user-defined name of the project. | `NOT NULL`, **UNIQUE** per `user_id` |
| `...` | | Other metadata fields like `description`, `settings`, timestamps. | |

##### **`better_tables`**
A container for sheets and data, analogous to a database or workbook.

| Column | Data Type | Description & Purpose | Dependencies & Constraints |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | The unique identifier for the table. | **Primary Key** |
| `project_id` | `uuid` | Links the table to its parent project. | **Foreign Key** -> `projects(id)` |
| `name` | `text` | The user-defined name of the table. | `NOT NULL` |
| `...` | | Other metadata fields like `description`, timestamps. | |

##### **`better_sheets`**
A single "tab" or grid view within a table.

| Column | Data Type | Description & Purpose | Dependencies & Constraints |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | The unique identifier for the sheet. | **Primary Key** |
| `table_id` | `uuid` | Links the sheet to its parent table. | **Foreign Key** -> `better_tables(id)` |
| `name` | `text` | The user-defined name of the sheet (e.g., "Sheet1"). | `NOT NULL` |
| `position` | `integer` | Defines the display order of the sheet tabs. | |
| `...` | | Other metadata fields like `description`, timestamps. | |

##### **`columns`**
Defines the schema and properties of a single column within a sheet.

| Column | Data Type | Description & Purpose | Dependencies & Constraints |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | The unique identifier for the column. | **Primary Key** |
| `sheet_id` | `uuid` | Links the column to its parent sheet. | **Foreign Key** -> `better_sheets(id)`, `ON DELETE CASCADE` |
| `name` | `text` | The user-visible header name of the column. | `NOT NULL`, **UNIQUE** per `sheet_id` |
| `mode`| `varchar` | Determines behavior: `'manual'` (user-edited) or `'automatic'`. | **CHECK** constraint, allows only these two values. |
| `data_type` | `text` | The underlying data type (e.g., `'text'`, `'number'`). | `NOT NULL` |
| `config` | `jsonb` | Generic JSONB field for storing various configuration settings. | |
| `...` | | Other property fields (`is_required`, `default_value`, etc.) | |

##### **`rows`**
Stores the actual cell data for a sheet.

| Column | Data Type | Description & Purpose | Dependencies & Constraints |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | The unique identifier for the row. | **Primary Key** |
| `sheet_id` | `uuid` | Links the row to its parent sheet. | **Foreign Key** -> `better_sheets(id)`, `ON DELETE CASCADE` |
| `row_data` | `jsonb` | **The Heart of Flexibility.** Stores all cell data for the row as a key-value object. Keys are `column.id`s, values are the cell content. | `NOT NULL` |

#### **2.2. Configuration Tables**

These tables store the settings that power the application's advanced features.

##### **`link_configurations`**
Defines the behavior of a "Linked Record" column type.

| Column | Data Type | Description & Purpose | Dependencies & Constraints |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | Unique identifier for the link configuration. | **Primary Key** |
| `column_id`| `uuid` | The specific column that acts as the link. | **Foreign Key** -> `columns(id)`, `ON DELETE CASCADE` |
| `target_table_id` | `uuid` | The `better_tables.id` this column links *to*. | `NOT NULL` |

##### **`rollup_configurations`**
Defines the behavior of a "Rollup" column.

| Column | Data Type | Description & Purpose | Dependencies & Constraints |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | Unique identifier for the rollup configuration. | **Primary Key** |
| `column_id`| `uuid` | The specific column that displays the rollup value. | **Foreign Key** -> `columns(id)`, `ON DELETE CASCADE` |
| `source_link_column_id` | `uuid`| **The Bridge.** The "Linked Record" column that provides the records to aggregate. | **Foreign Key** -> `columns(id)` |
| `source_field_column_id`| `uuid`| The column in the remote table to perform math on (e.g., the "Price" column). | **Foreign Key** -> `columns(id)` |
| `aggregation_function`|`varchar`| The mathematical operation to perform. | `NOT NULL`, **CHECK** constraint (`'count'`, `'sum'`, `'avg'`, etc.) |

##### **`automated_column_configurations`** & **`automated_column_rules`**
Defines the behavior of "Automatic Mode" columns. The relationship is one-to-many.

| Table | Column | Description & Purpose | Dependencies |
| :--- | :--- | :--- | :--- |
| `...configurations`|`column_id`| The column that will be automated. | **Foreign Key** -> `columns(id)` |
| `...configurations`|`source_column_id`| The column in the same row whose value is checked. | **Foreign Key** -> `columns(id)` |
| `...rules` | `automated_config_id` | Links the rule back to a specific configuration. | **Foreign Key** -> `...configurations(id)`|
| `...rules` |`rule_type`, `condition_value`, `result_value`| Defines the "if-then" logic of the rule. | `CHECK` on `rule_type` |

#### **2.3. System & Security Tables**

These tables manage the application's core operational and security aspects.

##### **`project_members`**
The central table for the Role-Based Access Control (RBAC) system.

| Column | Data Type | Description & Purpose | Dependencies & Constraints |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | The unique identifier for the membership record. | **Primary Key** |
| `user_id`| `uuid` | The user who is the member. | **Foreign Key** -> `auth.users(id)`, `ON DELETE CASCADE` |
| `project_id`|`uuid`| The project they are a member of. | **Foreign Key** -> `projects(id)` |
| `role` | `text` | The user's permission level for this project. | `NOT NULL`, **CHECK** constraint (`'owner'`, `'admin'`, etc.) |
| `...` | | Other metadata fields like `invited_by`, timestamps. | `UNIQUE` on `(user_id, project_id)` |

##### **`audit_logs`**
A chronological record of all significant events in the application.

| Column | Data Type | Description & Purpose | Dependencies & Constraints |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | The unique identifier for the log entry. | **Primary Key** |
| `project_id`| `uuid` | The project where the event occurred. | **Foreign Key** -> `projects(id)` |
| `user_id` | `uuid` | The user who performed the action. | Foreign Key -> `auth.users(id)` |
| `action_type`| `text` | A machine-readable category for the event (e.g., `'member_invited'`). | `NOT NULL` |
| `target_type`| `text` | The type of entity affected (e.g., `'row'`, `'column'`). | `NOT NULL` |
| `target_id`| `uuid` | The ID of the specific entity that was affected. | |
| `details`| `jsonb` | Rich, contextual data about the event. | |

---

We will now use this deeply detailed data model as a foundation to describe the features and systems. I have integrated the existing feature documentation into this new, more structured format.

### **3. Core Backend Systems**

#### **3.1. Security & Permissions: Role-Based Access Control (RBAC)**

*   **Architectural Approach:** A centralized security model where a single Deno Edge Function (`check-permissions`) serves as the gatekeeper for all sensitive actions.
*   **Key Tables:** `project_members`, `projects`
*   **Detailed Execution Flow:**
    1.  An API call is made to a function like `manage-members`.
    2.  That function first calls the `check-permissions` function, providing the `user_id`, `project_id`, and `required_permission`.
    3.  `check-permissions` queries the `project_members` table to get the user's `role`.
    4.  It includes a fallback check: if the user is not in `project_members`, it checks if they are the original owner via the `projects.user_id` field.
    5.  It compares the user's role level against a hard-coded hierarchy of permissions.
    6.  It returns a `true` or `false` response, allowing the original function to either proceed or fail with a "Permission Denied" error.

#### **3.2. Auditing & History: The Hybrid Model**

*   **Architectural Approach:** A dual-source system that combines the reliability of database triggers with the contextual richness of application-level logging.
*   **Key Tables:** `audit_logs`, and nearly all other tables via triggers.
*   **Detailed Execution Flow:**
    *   **Scenario 1 (Data Change):** A user updates a row. The `AFTER UPDATE` trigger on the `rows` table fires automatically and calls the `log_table_changes()` SQL function, which inserts a record into `audit_logs` with details about the old and new data.
    *   **Scenario 2 (Business Action):** A user invites a new member. The `manage-members` Deno function successfully adds a record to `project_members`. As its final step, it constructs a detailed JSONB object and explicitly inserts a record into `audit_logs` with `action_type: 'member_invited'`.
---

### **4. Feature Implementations**

This section details the end-to-end execution flow of the application's most critical features, explaining how the backend functions and database schema work in concert to deliver powerful functionality.

#### **4.1. Automatic Mode Columns**

*   **Purpose:** Allows a column's value to be set automatically based on the value of another column *within the same row*. This is ideal for creating simple, rule-based status columns or categorizations.
*   **Architectural Approach:** **API-driven**. This logic is actively handled by a Deno Edge Function (`evaluate-automated-columns`) that is called by the frontend. The database's role is passive storage and retrieval of the configuration and data.

##### **Key Database Components**

| Table | Role in this Feature |
| :--- | :--- |
| `columns` | The `mode` column, when set to `'automatic'`, identifies a column as being controlled by this feature. |
| `automated_column_configurations` | The central settings hub. Each row links an automatic `column_id` to its `source_column_id` and defines a `default_value`. |
| `automated_column_rules` | Stores the specific "if-then" logic. Linked via foreign key to an `automated_column_configurations` record. |
| `rows` | The target of the operation. The `row_data` JSONB field is both the source of input (reading the value from the `source_column_id` key) and the destination for the output (writing the calculated value to the automatic `column_id` key). |

##### **Detailed Execution Flow**

1.  **Event:** A user edits a cell on the frontend, triggering a data-save operation.
2.  **API Call:** After the initial data is saved, the frontend application makes a `POST` request to the `/evaluate-automated-columns` endpoint. The payload is a JSON object containing the `sheet_id` and the specific `row_id` that was modified, ensuring the operation is scoped and efficient.
3.  **Find Work:** The Deno function receives the request and executes its first query to find all columns on the specified sheet that need to be evaluated.
    ```sql
    -- Deno Function Logic (conceptual)
    SELECT id FROM columns WHERE sheet_id = :sheet_id AND mode = 'automatic';
    ```
4.  **Fetch Configuration:** The function takes the resulting column IDs and fetches their complete automation setup in a single, efficient query using Supabase's nested select feature. This retrieves the configuration and all its associated rules at once.
    ```sql
    -- Deno Function Logic (conceptual)
    SELECT *, automated_column_rules(*) 
    FROM automated_column_configurations
    WHERE column_id IN (:column_ids);
    ```
5.  **Fetch Data:** The function gets the complete, current `row_data` for the single row being processed.
    ```sql
    -- Deno Function Logic (conceptual)
    SELECT row_data FROM rows WHERE id = :row_id;
    ```
6.  **In-Memory Logic (The Core Calculation):** The primary logic runs inside the Deno function's memory. It iterates through each automatic column's configuration that was fetched:
    *   It reads the `sourceValue` from the `row_data` JSON object using the `source_column_id` from the configuration as the key.
    *   It passes this `sourceValue` and the list of associated rules to the `evaluateRule()` helper function.
    *   This helper function, running in TypeScript, iterates through the rules, respecting the `rule_order`. It performs checks based on `rule_type` (`equals`, `contains`, `greater_than`, etc.).
    *   The first rule that evaluates to `true` determines the `finalValue` from its `result_value`. If no rules match, the `default_value` from the configuration is used as the `finalValue`.
7.  **Save Results:** The function compares the calculated `finalValue` to the value currently stored in `row_data` for that automatic column.
    *   If the values are different, it prepares an `UPDATE` command for the `rows` table, using a `jsonb_set`-like operation to modify only the specific key corresponding to the automatic column's ID.
    *   All necessary updates for the row are executed concurrently using `Promise.all`.

---

#### **4.2. Rollup Columns**

*   **Purpose:** Allows a column to perform aggregations (`SUM`, `COUNT`, `AVG`, etc.) on linked records from a different table. This is the foundation for powerful data analysis and dashboarding.
*   **Architectural Approach:** **Purely database-driven**. This entire feature is orchestrated by a chain of PostgreSQL functions and triggers. It runs automatically and reliably on any data change without the application server's involvement, ensuring data is always consistent.

##### **Key Database Components**

| Table | Role in this Feature |
| :--- | :--- |
| `rows` | The source of the `rollup_update_trigger`. Any change to any row in the database initiates the entire process. |
| `columns` | Columns containing `jsonb` data in their `link_config` or `rollup_config` fields are identified as key players. |
| `link_configurations` | Defines the crucial link between tables, specifying the `target_table_id` for a linked record column. |
| `rollup_configurations` | The main settings table. It connects a rollup column to its `source_link_column_id` (the bridge), its `source_field_column_id` (the data to aggregate), and the `aggregation_function` (the math). |
| `better_sheets` & `better_tables` | Used by the database functions to navigate the hierarchy and find all the rows belonging to a target table. |

##### **Detailed Execution Flow: The Chain of Command**

This feature operates as a sophisticated chain of command within the database itself.

1.  **The Event:** A user inserts, deletes, or updates any record in the `rows` table.
2.  **The Sentry (The Trigger):** The `rollup_update_trigger` on the `rows` table fires automatically. Its sole, simple responsibility is to call the "Dispatcher" function, passing information about the changed row.
3.  **The Dispatcher (`trigger_update_rollup_values_cascading`)**: This PostgreSQL function acts as the high-level coordinator.
    *   **Job 1 (Direct Update):** It identifies the `table_id` of the changed row and immediately calls the "Worker" function (`update_rollup_values_with_cascading`) to recalculate rollups within that table.
    *   **Job 2 (Cascading Update):** It then executes a complex query, joining `rollup_configurations` and `link_configurations` to answer the question: "What other tables have rollups that depend on the table that just changed?" For each dependent table it finds, it also calls the "Worker" function, ensuring that changes cascade through the system.
4.  **The Worker (`update_rollup_values_with_cascading`)**: This PostgreSQL function orchestrates the update for *one entire table*.
    *   It first calls another function, `get_dependent_rollup_columns()`, to retrieve a list of all rollup columns in the table. Crucially, this list is ordered by `dependency_level` to ensure that if Rollup B depends on the result of Rollup A, Rollup A is *always* calculated first.
    *   It then begins a nested loop: for each rollup column in the ordered list, it loops through every single row in that column's sheet.
    *   Inside the loop, it calls the "Calculator" function for each cell, passing the `rollup_config_id` and the current `row_id`.
5.  **The Calculator (`calculate_rollup_value`)**: This is the specialist PostgreSQL function that performs the final calculation for a single cell.
    *   It fetches the specific `rollup_configurations` and `link_configurations` for the cell being calculated.
    *   **Dynamic SQL:** It dynamically constructs a SQL query string using the `format()` function, tailored to the `aggregation_function` (e.g., constructing a `SUM(...)` query or a `COUNT(...)` query).
    *   The dynamically built query uses an `EXISTS` subquery to efficiently find all rows in the target table that are linked. It does this by checking if the target row's ID exists as a value within the `row_data` of the linking column.
    *   It performs the aggregation on the `source_field_column_id` of those filtered, linked records.
    *   It executes the dynamic query, gets the result, and returns the final calculated value as text. This value is then passed back to the Worker, which saves it into the correct key in the `row_data` JSONB object.


### **5. Feature Deep Dive: Public Forms (Completed)**

*   **Purpose:** To allow users to create and share public web forms that, when submitted, insert data directly into their Better Excel tables. This feature is the primary mechanism for collecting data from non-authenticated users.
*   **Architectural Approach:** The system is built around a suite of Deno Edge Functions. The `forms-submit` function is the most critical, acting as a secure gateway for ingesting, validating, and processing data from public submissions.

#### **5.1. The Forms Data Model (Confirmed & Enriched)**

The database schema reveals a sophisticated and flexible system for defining, submitting, and tracking form data.

##### **`forms` Table**
The main table that stores the definition and high-level configuration of a form.

| Column | Data Type | Description & Purpose | Constraints & Features |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | The unique identifier for the form, used in the public URL. | **Primary Key** |
| `project_id`| `uuid` | The project this form belongs to. | Foreign Key -> `projects(id)` |
| `user_id` | `uuid` | The owner of the form. | Foreign Key -> `auth.users(id)` |
| `name` | `text` | The user-defined title of the form. | `NOT NULL` |
| `is_active`| `boolean`| A master switch to enable or disable submissions. | |
| `settings` | `jsonb` | A flexible object for storing various UI and behavior settings. | |
| `field_config`| `jsonb` | Stores the layout and configuration of fields as displayed on the form. | |
| **New Discovery:** | | | |
| `passcode` | `varchar`| Allows the form to be password-protected. | |
| `close_date` | `timestamptz`| Automatically closes the form to new submissions after this date. | |
| `form_type` | `text` | Defines how data is handled, `'cross_table'` can insert into multiple tables. | |

##### **`form_questions` Table**
Stores the definition of each field/question within a form.

| Column | Data Type | Description & Purpose | Constraints & Features |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | The unique identifier for the question. | **Primary Key** |
| `form_id` | `uuid` | Links the question back to its parent form. | **Foreign Key** -> `forms(id)`, `ON DELETE CASCADE` |
| `target_table_id`|`uuid`| **The Destination Table.** The `better_tables.id` where this question's answer will be stored. | `NOT NULL` |
| `target_column_id`|`uuid`| **The Destination Column.** The `columns.id` where this question's answer will be stored. | `NOT NULL` |
| `question_label`| `text` | The text displayed to the user for this question. | `NOT NULL` |
| `is_required` | `boolean`| If true, the form cannot be submitted without an answer to this question. | |
| `question_type` | `text` | The type of input to render (e.g., `'text_input'`, `'dropdown'`). | `NOT NULL` |
| `question_config`|`jsonb`| Stores settings specific to the `question_type` (e.g., options for a dropdown).| |

##### **`form_submissions` Table**
Acts as a ledger, storing a record of every attempt to submit a form.

| Column | Data Type | Description & Purpose | Constraints & Features |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | The unique identifier for the submission attempt. | **Primary Key** |
| `form_id` | `uuid` | The form that was submitted. | **Foreign Key** -> `forms(id)` |
| `submission_data`|`jsonb`| A raw, immutable copy of the JSON payload sent by the user. | `NOT NULL` |
| `status` | `text` | The workflow status of the submission (e.g., `'new'`, `'reviewed'`). | |
| `processing_status`|`text`| The technical status of the data insertion (e.g., `'pending'`, `'completed'`). | |
| `created_records`|`jsonb`| A log of which records were created in which tables (e.g., `{"table_id": "row_id"}`). | |
| `processing_log` |`jsonb`| A detailed, structured log of the processing steps for each question. | |
| `...` | | Rich metadata fields (`submitter_email`, `submitter_ip`, `user_agent`, timestamps). | |

##### **`submission_answers` Table**
A detailed breakdown of each answer within a submission.

| Column | Data Type | Description & Purpose | Constraints & Features |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | The unique identifier for the answer record. | **Primary Key** |
| `submission_id`|`uuid`| Links the answer back to a parent submission. | **Foreign Key** -> `form_submissions(id)`, `ON DELETE CASCADE` |
| `question_id`|`uuid`| The specific question that was answered. | **Foreign Key** -> `form_questions(id)` |
| `answer_value`|`text` | The processed and validated value of the answer. | |
| `created_record_id`|`uuid`| The ID of the row in the target table that was created or updated by this answer. | |
| `...` | | Processing metadata (`processing_status`, `error_message`). | |

#### **5.2. The Security Model for Public Endpoints**

The `forms-submit` function is hardened against common web vulnerabilities using a self-contained security library at the top of the file.

*   **Rate Limiting:** Prevents brute-force spam by limiting an IP to 10 submissions per minute.
*   **Input Sanitization:** Mitigates Cross-Site Scripting (XSS) by escaping HTML characters in all incoming data.
*   **Secure Headers:** Protects the client by applying a strict set of HTTP security headers to every response.

#### **5.3. Detailed Execution Flow: `forms-submit`**

The `forms-submit` Deno function is a sophisticated data processing pipeline that orchestrates the entire submission process.

1.  **Security Gates:** The request is immediately subjected to the security model: the client's IP is identified and the rate limiter is checked.
2.  **Sanitization:** The incoming JSON body is fully sanitized to prevent XSS.
3.  **Fetch Form Definition:** The function queries the `forms` table and joins with `form_questions` for the given `form_id`. This provides the complete "map" of where each answer needs to go and its configuration. It also allows the function to check if the form is active, password-protected, or past its close date.
4.  **Create Submission Record:** It performs its first `INSERT` into the `form_submissions` table, creating a ledger entry for this attempt with a status of `'pending'`. This ensures every submission attempt is recorded.
5.  **The Processing Loop:** The function begins its core logic, iterating through each `question` from the form definition.
    *   **Get Destination Info:** It fetches the full record for the `target_column_id` from the `columns` table to determine its `data_type` and parent `sheet_id`.
    *   **Data Validation & Conversion:** The raw answer is passed to the `convertAnswerToColumnType` helper function. This robust function attempts to convert the answer to the target column's `data_type` and throws an error if the conversion fails (e.g., saving "abc" to a number column).
    *   **Insert or Update Logic:** A key behavior is that a single form submission can create a single row in *multiple* tables if the questions are mapped to different destinations.
        *   It checks an in-memory object (`createdRecords`) to see if a row has already been created for the question's `target_table_id` during this submission.
        *   **If NO:** It performs an `INSERT`, creating a *new row* in the target sheet. It stores the new `row_id` in the `createdRecords` object.
        *   **If YES:** It performs an `UPDATE` on the row that was just created in this same session, merging the new key-value pair for the current question into the `row_data`.
    *   **Log Answer Status:** After each question is processed, it performs an `INSERT` into the `submission_answers` table to log the outcome for that specific answer, including any error messages.
6.  **Finalize Submission:** After the loop finishes, the function updates the original `form_submissions` record, setting the final `processing_status` and saving the `created_records` map and the detailed `processing_log`.
7.  **Return Response:** It returns a detailed JSON response to the user, indicating the final status and any specific errors.

---
This provides a complete and detailed picture of the Forms feature. We are now ready to move on to the final topic.

### **Next Steps: Moving on to AI**

The last major topic you outlined was AI. This is likely a very different type of feature.

**Action:** To begin documenting the **AI Features**, please provide the code for the primary backend function that handles AI interactions. Based on your initial documentation, this is likely located at:

`/supabase/functions/ai-processor/index.ts`


Excellent. This is the final piece of the puzzle. The schema for `ai_rules` confirms our understanding and adds the critical database-level details. We now have everything we need to assemble the final, comprehensive documentation.

I will now integrate this last piece of information and present the complete document, combining all of our analysis into a single, cohesive guide.

---

## **Comprehensive Backend & Database Architecture Documentation**

### **1. Architectural Philosophy: The Database as the Brain**

This application's backend is built on a **database-centric** philosophy. Instead of placing all business logic in application code (like Deno Edge Functions), it leverages the full power of PostgreSQL to handle complex operations, enforce data integrity, and trigger calculations automatically.

This design choice has several key advantages:
*   **Data Integrity:** Business rules (e.g., "a rollup must update when its source data changes," "a role must be one of five specific values") are enforced at the data layer, making them unavoidable and consistent across the entire application.
*   **Performance:** Executing logic within the database through compiled functions and triggers is often faster than multiple round-trips between an application server and the database, especially for complex data manipulations.
*   **Atomicity:** Complex operations that involve multiple steps can be wrapped in transactions, ensuring that data is never left in a partially updated, inconsistent state.

The core technologies enabling this are:
*   **PostgreSQL Functions:** Reusable blocks of SQL and PL/pgSQL code that encapsulate complex logic (e.g., `calculate_rollup_value`).
*   **Database Triggers:** Procedures that automatically execute in response to data modification events (`INSERT`, `UPDATE`, `DELETE`), forming the backbone of the auditing and rollup systems.
*   **JSONB Data Type:** A highly efficient binary JSON format that allows for storing flexible, schema-less data within a structured relational database. This provides the perfect blend of flexibility for user-defined tables and the power of relational integrity.

---

### **2. Core Data Model & Schema Deep Dive**

The data model is organized into three logical categories: the data hierarchy itself, configuration tables that define feature behavior, and system tables that manage security and auditing.

#### **2.1. Data Hierarchy Tables**
*   **`projects`**: The top-level container for all user-created content.
*   **`better_tables`**: A container for sheets and data, analogous to a database or workbook.
*   **`better_sheets`**: A single "tab" or grid view within a table.
*   **`columns`**: Defines the schema and properties of a single column within a sheet.
*   **`rows`**: Stores the actual cell data for a sheet using a flexible `row_data` JSONB column.

#### **2.2. Configuration Tables**
*   **`link_configurations`**: Defines the behavior of a "Linked Record" column type.
*   **`rollup_configurations`**: Defines the behavior of a "Rollup" column.
*   **`automated_column_configurations` & `automated_column_rules`**: Defines the "if-then" logic for "Automatic Mode" columns.
*   **`forms`, `form_questions`, `form_submissions`, `submission_answers`**: The full suite of tables that define public forms, their questions, and track all submission data.

#### **2.3. System & Security Tables**
*   **`project_members`**: The central table for the Role-Based Access Control (RBAC) system, linking users to projects with specific roles.
*   **`audit_logs`**: A chronological record of all significant events in the application.
*   **`ai_rules`**: Stores AI-generated rule definitions that can be applied to columns.

---

### **3. Core Backend Systems**

#### **3.1. Security & Permissions: Role-Based Access Control (RBAC)**
*   **Architectural Approach:** A centralized security model where a single Deno Edge Function (`check-permissions`) serves as the gatekeeper for all sensitive actions.
*   **Key Tables:** `project_members`, `projects`.
*   **Execution Flow:** An API function (e.g., `manage-members`) calls `check-permissions`, which queries the `project_members` table for the user's role. It compares the user's role level against a hard-coded hierarchy of permissions and returns `true` or `false`, allowing the original function to proceed or fail.

#### **3.2. Auditing & History: The Hybrid Model**
*   **Architectural Approach:** A dual-source system that combines the reliability of database triggers with the contextual richness of application-level logging.
*   **Key Table:** `audit_logs`.
*   **Execution Flow:** Low-level data changes (e.g., a user updates a row) are automatically captured by table triggers. High-level business actions (e.g., a user invites a member) are explicitly logged by the relevant Deno Edge Function, inserting a record into `audit_logs` with rich contextual details in a JSONB field.

---

### **4. Feature Implementations: Data Automation**

#### **4.1. Automatic Mode Columns**
*   **Purpose:** Allows a column's value to be automatically set based on the value of another column *within the same row*.
*   **Architecture:** API-driven, orchestrated by the `evaluate-automated-columns` Deno function.
*   **Execution Flow:** The frontend calls the function after a row is modified. The function fetches the relevant automation rules from `automated_column_configurations` and `automated_column_rules`. It then reads the source value from the row's `row_data`, evaluates the rules in TypeScript, and writes the calculated result back to the `row_data`.

#### **4.2. Rollup Columns**
*   **Purpose:** Allows a column to perform aggregations (`SUM`, `COUNT`, `AVG`, etc.) on linked records from another table.
*   **Architecture:** Purely database-driven, ensuring data is always consistent.
*   **Execution Flow:** A trigger on the `rows` table initiates a chain of PostgreSQL functions. A "Dispatcher" function identifies all affected tables (including cascading dependencies). A "Worker" function then orchestrates the updates for each table, calling a "Calculator" function (`calculate_rollup_value`) for each cell. This final function dynamically builds and executes a SQL query to perform the aggregation and return the final value.

---

### **5. Feature Implementation: Public Forms**

*   **Purpose:** To collect data from non-authenticated users via a public web form.
*   **Architecture:** Handled by a suite of Deno Edge Functions, primarily the `forms-submit` function, which acts as a secure data ingestion pipeline.
*   **The Forms Data Model:** A set of four tables (`forms`, `form_questions`, `form_submissions`, `submission_answers`) defines the form's structure, its questions, the destination for each answer, and a complete ledger of all submission attempts and their outcomes.
*   **Security:** The `forms-submit` endpoint is hardened with a self-contained security library that provides rate limiting, input sanitization (to prevent XSS), and secure HTTP headers.
*   **Execution Flow:** A submission triggers the `forms-submit` function. After passing security checks, the function fetches the form's definition. It creates a master record in `form_submissions`, then loops through each question. For each answer, it validates and converts the data type, then performs an `INSERT` or `UPDATE` into the appropriate row in the target table. The entire process and any errors are logged in `form_submissions` and `submission_answers`.

---

### **6. Feature Implementation: AI-Powered Features**

*   **Purpose:** To leverage Google Gemini to provide intelligent capabilities that simplify complex tasks.
*   **Architecture:** Centered around the `ai-processor` Deno Edge Function, which acts as a secure proxy and prompt engineering layer to the Google Gemini API.

#### **6.1. The AI Data Model (`ai_rules` Table - Confirmed)**
Stores AI-generated rule definitions that can be applied to columns.

| Column | Data Type | Description & Purpose | Constraints & Features |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | The unique identifier for the AI-generated rule. | **Primary Key** |
| `column_id`| `uuid` | The column to which this rule applies. | `NOT NULL`, **Foreign Key** -> `columns(id)` |
| `rule_type`| `text` | The category of rule, as determined by the AI. | `NOT NULL`, **CHECK** (`'computed'`, `'validation'`, `'formatting'`) |
| `rule_definition`|`jsonb`| A structured JSON object, generated by the AI, containing the specific logic. | `NOT NULL` |
| `natural_language_description`|`text`| The original plain-English description provided by the user. | |
| `is_active` | `boolean`| A flag to control whether the rule is currently being enforced. | |
| `created_by` | `uuid` | The user who initiated the creation of the rule. | `NOT NULL`, **Foreign Key** -> `auth.users(id)` |

#### **6.2. AI Interaction Workflows**

The `ai-processor` function dispatches actions based on a user's request. All workflows first check the user's permissions via the `check-permissions` function.

*   **`create_rule` Workflow:**
    1.  A user provides a natural language description for a rule.
    2.  The function builds a detailed prompt for Gemini, including the user's text and context about the target column.
    3.  Gemini returns a structured JSON object representing the rule.
    4.  The function parses the response and performs an `INSERT` into the `ai_rules` table, saving the new rule as `is_active: false` for user review.

*   **`cleanup_data` & `fill_data` Workflows:**
    1.  A user selects data and an AI action.
    2.  The function builds a prompt including the selected data and, for `fill_data`, a sample of existing data for context.
    3.  Gemini returns a JSON array of suggested changes, each with a confidence score and explanation.
    4.  Crucially, the function **does not save any data**. It returns the AI's suggestions to the frontend, where the user must review and approve them before the changes are committed.


That is an excellent and crucial question. Authentication is the front door to the entire application, and we can deduce exactly how it works from the patterns in the backend code we've analyzed.

You don't need to provide any new files for this. The evidence is already present in the functions you've sent. Let's add this critical section to the documentation.

---

### **7. System Deep Dive: Authentication & Authorization**

This section details the application's authentication model ("Who are you?") and how it connects to the authorization model ("What are you allowed to do?").

#### **7.1. Architectural Approach: A Delegated Model**

The application does not implement its own authentication system from scratch. Instead, it **delegates** all core authentication responsibilities to **Supabase Auth**, a built-in feature of the Supabase platform.

This is a modern and secure architectural choice that provides several key benefits:
*   **Security:** Leverages a battle-tested authentication service that handles password hashing, secure token generation, and protection against common vulnerabilities.
*   **Simplicity:** The application code does not need to manage sensitive credentials or the complexities of token issuance and refresh logic.
*   **Full-Featured:** It comes with built-in support for user sign-up, sign-in, password resets, and third-party logins (if configured).

The application's backend code operates on the assumption that if a user provides a valid **JSON Web Token (JWT)**, that token has been securely issued by Supabase Auth and can be trusted.

#### **7.2. The User Login Flow (Client-Side)**

The login process is handled entirely on the frontend, using the Supabase client-side library.

1.  **User Interaction:** The user enters their email and password into the `LoginForm.tsx` component.
2.  **Client-Side API Call:** The frontend code calls a Supabase client library function, likely `supabase.auth.signInWithPassword({ email, password })`.
3.  **Supabase Auth Verification:** The Supabase client library sends the credentials securely to the Supabase Auth service. Supabase Auth hashes the provided password and compares it to the stored hash in its `auth.users` table.
4.  **JWT Issuance:** If the credentials are valid, Supabase Auth generates a short-lived, cryptographically signed JWT.
5.  **Token Storage:** The JWT is sent back to the client. The Supabase client library automatically and securely stores this token in the browser's `localStorage`.
6.  **Authenticated State:** The `AuthContext.tsx` on the frontend is updated. The user is now considered "logged in," and the frontend can make authenticated requests to the backend.

#### **7.3. The Authenticated API Request Flow (Server-Side)**

This is the process that every secure Deno Edge Function (`manage-members`, `ai-processor`, etc.) follows to verify the identity of the user making a request.

1.  **Token Attachment:** When the frontend needs to call a secure backend function, it retrieves the JWT from `localStorage` and attaches it to the request in the `Authorization` header.
    ```
    Authorization: Bearer <the_long_jwt_string>
    ```
2.  **Token Extraction:** The Deno Edge Function receives the request. The very first step in its logic is to extract the token from the header.
    ```javascript
    // Code seen in every secure Deno function
    const authHeader = req.headers.get('authorization');
    const token = authHeader.replace('Bearer ', '');
    ```
3.  **Token Verification:** The Deno function **does not verify the token itself**. Instead, it securely forwards the token to the trusted Supabase Auth service endpoint for verification.
    ```javascript
    // Server-to-server call to validate the user's token
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'apikey': serviceRoleKey 
        }
    });
    ```
4.  **Identity Confirmation:**
    *   If the `userResponse` is successful (`200 OK`), it means the JWT is valid (i.e., the signature is correct and it has not expired). The response body contains the user's secure details, including their unique `id`.
    *   The Deno function extracts this `id` (`const currentUserId = userData.id;`) and now knows, with certainty, who is making the request.
    *   If the `userResponse` fails, it means the token is invalid, and the function immediately terminates with an "Invalid authorization token" error.
5.  **Authorization Step:** With the user's identity **authenticated**, the function can now proceed to the **authorization** step: calling the `check-permissions` function to determine if *this specific user* is allowed to perform the requested action.

#### **7.4. Summary of Responsibilities**

| Component | Responsibility |
| :--- | :--- |
| **Frontend (`AuthContext.tsx`, `LoginForm.tsx`)** | Manages UI state, captures credentials, and uses the Supabase client library to sign the user in and store the received JWT. |
| **Supabase Auth Service** | The central authority. Manages user accounts, validates credentials, issues and verifies all JWTs. |
| **Deno Edge Functions (Backend)** | **Trusts Supabase Auth.** Extracts the JWT from requests, forwards it to Supabase Auth for verification, and uses the confirmed user ID to perform authorization checks. |
| **`check-permissions` Function** | **Handles Authorization.** Takes a confirmed user ID and determines what actions they are allowed to perform based on their role in the `project_members` table. |