/**
 * Mount a {@link FormView} into a plain DOM container (demo glue).
 */

import {
  formatFormValue,
  type FormView,
} from "@gridyard/workspace-runtime";

/**
 * Replaces `container` children with sectioned labeled fields.
 * Empty when `form` is null or has no visible sections.
 */
export function renderFormView(
  container: HTMLElement,
  form: FormView | null,
): void {
  container.replaceChildren();
  if (form === null || form.sections.length === 0) {
    const empty = document.createElement("p");
    empty.className = "form-empty";
    empty.textContent = "No form fields for this record / permission set.";
    container.append(empty);
    return;
  }

  for (const section of form.sections) {
    const sectionEl = document.createElement("section");
    sectionEl.className = "form-section";
    sectionEl.setAttribute("aria-labelledby", `form-section-${section.id}`);

    const heading = document.createElement("h3");
    heading.className = "form-section-title";
    heading.id = `form-section-${section.id}`;
    heading.textContent = section.title;
    sectionEl.append(heading);

    const list = document.createElement("div");
    list.className = "form-fields";

    for (const field of section.fields) {
      const row = document.createElement("div");
      row.className = "form-field";
      row.dataset.fieldId = field.fieldId;
      row.dataset.access = field.access;

      const label = document.createElement("label");
      label.className = "form-label";
      const inputId = `form-field-${field.fieldId}`;
      label.htmlFor = inputId;
      label.textContent = field.label;

      const input = document.createElement("input");
      input.id = inputId;
      input.type = "text";
      input.className = "form-input";
      input.value = formatFormValue(field.value);
      input.readOnly = true;
      if (field.access === "view") {
        input.title = `View only: ${field.fieldId}`;
      }

      row.append(label, input);
      list.append(row);
    }

    sectionEl.append(list);
    container.append(sectionEl);
  }
}
