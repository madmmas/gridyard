# Workspace Schema Spec

## Deliverable

The "schema" module: parsing and validating workspace definitions that
describe layout, data sources, fields, permissions, behaviors,
validation rules, actions, and extensions.

## Declarative user interfaces

Applications should be defined through configuration rather than
hardcoded interfaces. A workspace definition describes: layout, data
sources, fields, permissions, behaviors, validation rules, actions, and
extensions.

For example, a "Customer Management" workspace definition would specify
a name, and a layout made of a main region of type table, a sidebar
region of type notes, and a footer region of type summary. The runtime
interprets that definition and generates the user experience — no
hand-written UI code is involved.

## Separation of data, UI, and business logic

The platform separates four concerns: the data model, the workspace
definition, the runtime engine, and the business rules. This separation
is what allows the same underlying data to be represented in multiple
ways over time. **Current product focus** is the spreadsheet-grade
**main and bottom grid** workspace (Aggregate / Notes on bottom). Other
lenses (dashboard, approval workflow, analytical views, structured
**form** panels) are not in current scope — see
`04-layout-and-permission-engine-spec.md` (Form engine out of scope).

## User-centered flexibility

Users should not be blocked by software limitations. The platform should
support custom layouts, adjustable column sizes, personalized views,
saved filters, custom calculations, notes and comments, and
user-specific preferences. At the same time, organizations retain
control over what users are allowed to change — see the permission
engine in `04-layout-and-permission-engine-spec.md`.

## Example workspace definitions

**Employee Management** — a workspace named "Employee Management",
restricted to the HR_MANAGER role, with a main region showing a table
sourced from "employees", a right-side region showing notes bound to
employee.comments, and a footer region summarizing totalEmployees and
activeEmployees.

**Loan Review** — a workspace with a main region showing the loan table;
a right region containing customer history, notes, and documents; a
footer region showing total overdue amount and average delay; and a
"send reminder" action.

**Invoice Review** — a workspace with a main region showing the invoice
table, a right region containing customer history and payment notes, and
a footer region showing total amount, tax, and outstanding balance.

**Stock Management** — a workspace with a main region showing inventory,
and a right region containing warehouse notes and supplier history.

## Field- and view-level schema

Similar in spirit to a database schema, an API schema, or a GraphQL
schema — this layer defines the data, layout, permissions, and behavior
for one entity.

For example, an "Employee" entity might define a `name` field (type
text, editable) and a `salary` field (type currency, visible only to the
HR role), and two named views: a "manager" view showing columns name,
department, and status; and a "payroll" view showing columns name,
salary, and tax. Each view is a different lens over the same entity
schema, gated by the permission engine.

## ERP as a consumer of the schema

Domain applications (accounting, inventory, HR, and so on) should not
need to know about React components or rendering internals — they
produce workspace definitions in this schema format, and this engine
renders them. The engine itself has no knowledge of ERP domain concepts;
domain logic and workspace definitions live entirely in the consuming
application.
