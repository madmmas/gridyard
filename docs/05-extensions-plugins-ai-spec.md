# Extensions, Plugins, and AI/Agent Capabilities Spec

## Deliverable

The extension/plugin system, custom cell type registry, workflow action
framework, and — as a later phase — the AI-native interaction layer.

## Plugin system

The platform should support custom components beyond the built-in ones,
such as: charts, maps, images, rich text, code editors, document
viewers, timelines, kanban boards, and AI assistants.

## Custom cell types

Cells should support more than plain text. Possible types: text, number,
currency, date, checkbox, dropdown, progress bar, rating, formula,
markdown, image, JSON viewer, and fully custom widgets.

## Workflow extensions

Workspaces can include configurable actions rather than hardcoded
buttons — examples: submit, approve, reject, notify, export, and
generate report.

## Collaboration features (future)

Comments, mentions, activity history, change tracking, version history,
and collaborative editing.

## AI and agent capabilities

The workspace architecture should be designed for AI-native interaction
from the start, even though the implementation itself is a later phase.

### Workspace generation

A user might ask: "Create a view showing delayed transactions." The
agent responds by generating the pieces of a workspace — filters,
columns, summary sections, and charts — not by writing code.

A fuller example: a user asks for "a report for garments shipment delays
by factory, showing orders that need attention." The agent produces a
workspace with a main grid of shipment orders, a filter for delay
greater than seven days, a right panel with factory details, a footer
showing total delayed quantity, and a chart of the delay trend.

The agent is not writing application code — it is composing a workspace
definition, the same format described in `03-workspace-schema-spec.md`,
the same format a human admin would produce by hand.

### Data understanding

Explain unusual values, detect anomalies, summarize selected records,
and suggest improvements.

### Natural language actions

Examples: "Show me last month's performance." "Create a report for
management." "Find records requiring attention."
