# Repository Guidelines

## Project Structure & Module Organization
- Static MV3 extension; keep HTML, CSS, and JS alongside `manifest.json` so entry points stay valid.
- `manifest.json` wires the popup (`popup.html`), background worker (`background.js`), and fullscreen view (`fullscreen.html`); update permissions and resources together.
- `popup.html`, `popup.js`, and `styles.css` drive the main task dashboard; reuse existing selectors and layout patterns when extending UI elements.
- `fullscreen.html`, `fullscreen.js`, and `fullscreen.css` cover the kanban board and export flows; follow the `TaskManager`/`KanbanTaskManager` structure for new behaviors.
- `background.js` keeps timers and storage in sync—keep logic lightweight to avoid service worker restarts.
- `icons/` holds the 16/48/128 PNG assets required by Chrome; regenerate every size when artwork changes.

## Build, Test, and Development Commands
- `chrome://extensions` → Load unpacked → select the repository root: installs the development build; click the refresh icon after each change.
- `zip -r dist/task-time-manager.zip manifest.json background.js popup.html popup.js styles.css fullscreen.html fullscreen.js fullscreen.css icons` creates a publishable archive (run inside the repo; create `dist/` if absent).

## Coding Style & Naming Conventions
- Use 4-space indentation, arrow functions for callbacks, and descriptive method names within ES6 classes.
- PascalCase classes (`TaskManager`), camelCase variables and methods, kebab-case CSS classes, and concise camelCase storage keys.
- Keep UI copy in Portuguese and reuse wording across popup and fullscreen views; prefer template literals for interpolated strings and consolidate repeated text.

## Testing Guidelines
- Manual QA: reload the unpacked build, verify task CRUD, timer start/pause/reset, project filters, kanban drag-and-drop, and export downloads.
- Inspect `chrome://extensions` errors and DevTools consoles (popup and fullscreen) for warnings; resolve them before pushing.
- Confirm storage persistence by closing Chrome completely, reopening, and ensuring tasks and timers restore as expected.

## Commit & Pull Request Guidelines
- Match repository history: imperative subject with scope hint and concise detail (`Add projects panel…`, `Refactor fullscreen.css…`); add body context when needed.
- Keep commits scoped (UI layout, data logic, assets). Include before/after screenshots for visual changes and list manual test steps in the PR description.
- Link issues when applicable and flag any manifest, permission, or storage schema changes in both commit and PR notes.

## Security & Configuration Tips
- Retain the minimal permission footprint (`storage` only) unless absolutely necessary; discuss expansions with maintainers first.
- When exposing new assets, update `web_accessible_resources` and ensure exported data sanitizes sensitive fields before download.
