# mock-server

Serves `db.json` behind a REST-shaped API via
[json-server](https://github.com/typicode/json-server), so
`@gridyard/workspace-runtime`'s REST data adapter
(`docs/04-layout-and-permission-engine-spec.md`) has something real to
point at before an actual backend exists. See
`.cursor/rules/040-mock-data.mdc` for conventions on adding fixtures.

## Run

    npm install
    npm start

Serves on `http://localhost:4000`. Each top-level key in `db.json`
becomes a REST resource, e.g. `GET /loans`, `GET /loans/1`,
`GET /employees`, `GET /invoices` — json-server also supports
filtering, sorting, and pagination via query params out of the box.

## Fixtures

- `loans` — matches the "Loan Review" workspace example in
  `docs/03-workspace-schema-spec.md` and the UI mockups.
- `employees` — matches the "Employee Management" example.
- `invoices` — matches the "Invoice Review" example.
