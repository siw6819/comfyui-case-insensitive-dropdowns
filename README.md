# Alphabetical Sort — ComfyUI Custom Node

Fixes ComfyUI's case-sensitive dropdown sorting so all combo widgets sort **A→Z, case-insensitively** (e.g. `apple`, `Banana`, `cherry` instead of `Banana`, `apple`, `cherry`).

## Install

1. **Restart your ComfyUI server** (a full server restart is required so Python picks up the new `__init__.py`).
2. **Hard-refresh your browser** (`Ctrl+Shift+R` / `Cmd+Shift+R`) to clear any cached JS.

The folder layout must be exactly:
```
ComfyUI/
└── custom_nodes/
    └── comfyui-case-insensitive-dropdowns/        ← this folder name
        ├── __init__.py
        └── js/
            └── alphabetical_sort.js
```

## Usage

The extension is **global** — once installed, every combo dropdown in every workflow is sorted automatically, even without the node. The node just makes the intent visible in a saved workflow.

To add the node: double-click the canvas → search **"Alphabetical Sort"** → it lives under the **utils** category.

## How it works

ComfyUI automatically loads every `.js` file from a custom node's `js/` directory into the browser. This extension uses three official ComfyUI hooks:

| Hook | What it does |
|---|---|
| `beforeRegisterNodeDef` | Sorts the raw combo value lists in `nodeData` before any widget is built — the cleanest, earliest interception point |
| `nodeCreated` | Re-sorts widgets on any node instance after creation (catches dynamic/runtime values) |
| `afterConfigureGraph` | Re-sorts everything when a workflow is loaded |

The sort uses `localeCompare` with `sensitivity: "base"` (true case-insensitive, accent-aware) and preserves your current selection after re-sorting.

## Troubleshooting

- **Node doesn't appear in the menu?** Make sure you did a **full server restart**, not just a browser refresh. Python needs to scan the new `__init__.py`.
- **Dropdowns still case-sensitive?** Do a hard-refresh (`Ctrl+Shift+R`). Check the browser console for `[AlphabeticalSort] Combo dropdowns will sort case-insensitively.` — if you see it, the extension loaded correctly.
- **Some dropdowns not sorted?** A handful of nodes use non-string combo values or build their widgets in unusual ways — these are edge cases the extension may not catch.
