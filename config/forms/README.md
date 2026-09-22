# Form definitions

Each file is one safety report form, expressed as **JSON Schema + RJSF uiSchema**. Nothing about
a form lives in application code.

These are the **shipped** forms. Admins can also create and edit forms in the app
(Administration → Forms). A form saved there is stored in the datastore under
`data/config/forms.json` and takes precedence over the file here with the same ID. Visibility and
gatekeeper routing then live on the saved form's `meta.departments` and `meta.gatekeeperGroup`.
Changing a file here still works for forms that have never been saved from the editor.

## File shape

```jsonc
{
  "meta": {
    "formId": "voluntary-safety-report", // must match the filename and the persona map key
    "code": "VSR-001",
    "title": "Voluntary Safety Report",
    "summary": "One line shown on the form picker",
    "supportsConfidential": true,        // renders the confidentiality control, suppresses identity
    "attachmentsRequired": false         // block submission until at least one file is attached
  },
  "schema":   { /* JSON Schema draft 7 */ },
  "uiSchema": { /* RJSF uiSchema: widgets, order, help text */ }
}
```

## Patterns used

| BRD requirement | How to express it |
|---|---|
| Conditional display ("If flight related = Yes") | `dependencies` with a `oneOf` branch that adds the dependent fields and lists them in `required` |
| Cascading dropdown (hazard category to hazard type) | `dependencies` on the parent, one `oneOf` branch per parent value |
| Character limits | `maxLength` — 255 for short text, 2000–5000 for text areas |
| Past dates only | `format: "date"` plus the `notFutureDate` rule in `src/lib/forms.ts` |
| Phone numbers | `pattern: "^[0-9]{10}$"` |
| Repeating sections (up to 4 crew) | `type: "array"` with `maxItems: 4` and an object `items` |
| Mandatory | list the property in `required` |
| Sections, in BRD order | `uiSchema["ui:groups"]`: `[{ "title", "description", "fields": [...] }]`. Each section renders as a numbered card; `fields` sets the order, including conditional fields, so they appear right after the question that opens them. A section with only a `description` is a note, e.g. "filled in from CAE after you submit". |
| Full-width field | `"ui:options": { "fullWidth": true }`. Text areas, checkbox groups and repeating sections are full width anyway. |
| Time (24-hour) | `pattern: "^([01][0-9]\|2[0-3]):[0-5][0-9]$"` |
| Date and time | `format: "date-time"` |
| The common fields (name, email, staff number, department) | Do not add them. Every form shows them at the top, read-only, from the account, and hides them when the report is confidential (BRD 6, `src/components/sms-form.tsx`). |
| A field that is drawn, not typed - today only the AIRPROX diagram | An object property with `"ui:field": "airproxDiagram"`. The field is registered in `src/components/sms-form.tsx`; see `air-traffic-incident.json`. |

## Adding a form as a file

Add a file here plus an entry in `config/persona-form-map.json` and
`config/gatekeeper-groups.json` → `routing`. No code changes. Or use the form editor.

The identity block (name, email, staff number, department, base) is **not** part of any schema —
it comes from the SSO session and is stamped on the report at submission.
