import { app } from "../../scripts/app.js";

/**
 * AlphabeticalSort Extension
 *
 * Sorts all combo (dropdown) widget values case-insensitively across every
 * node in every workflow.
 *
 * Strategy:
 *  1. beforeRegisterNodeDef — sort values inside nodeData.input before
 *     widgets are ever built. This is the earliest, cleanest hook.
 *  2. nodeCreated — sort widgets on any node instance after creation
 *     (catches workflow-load and dynamic nodes).
 *  3. afterConfigureGraph — re-sort everything after a full graph load.
 *
 * The extension loads automatically once the folder is in custom_nodes.
 * The Python-backed "Alphabetical Sort 🔤" node is optional; it just makes
 * it visible in a saved workflow so others know the extension is in use.
 */

const EXT_NAME = "Comfy.AlphabeticalSort";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sort an array of strings case-insensitively, in-place. */
function ciSort(arr) {
  if (!Array.isArray(arr) || arr.length < 2) return arr;
  if (typeof arr[0] !== "string") return arr;          // skip numeric combos
  arr.sort((a, b) =>
    String(a).localeCompare(String(b), undefined, { sensitivity: "base" })
  );
  return arr;
}

/**
 * Walk the raw input spec for a node type (nodeData.input) and sort every
 * combo list in-place before widgets are created from it.
 */
function sortNodeDataCombos(nodeData) {
  if (!nodeData?.input) return;
  for (const group of Object.values(nodeData.input)) {
    if (typeof group !== "object" || group === null) continue;
    for (const spec of Object.values(group)) {
      // A combo input is a tuple where element 0 is an Array of strings.
      if (Array.isArray(spec) && Array.isArray(spec[0])) {
        ciSort(spec[0]);
      }
    }
  }
}

/**
 * Sort the options.values of any combo widget that already exists on a node
 * instance, while keeping the current selection valid.
 */
function sortNodeWidgets(node) {
  if (!node?.widgets) return;
  for (const w of node.widgets) {
    if (w.type !== "combo") continue;
    if (!Array.isArray(w.options?.values)) continue;
    const current = w.value;
    ciSort(w.options.values);
    // Restore selection (localeCompare may have moved it)
    w.value = w.options.values.includes(current)
      ? current
      : w.options.values[0] ?? current;
  }
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

app.registerExtension({
  name: EXT_NAME,

  /**
   * Hook 1 — runs for every node type before widgets are built.
   * Sorting here means the widget is born already sorted.
   */
  async beforeRegisterNodeDef(nodeType, nodeData /*, app */) {
    sortNodeDataCombos(nodeData);
  },

  /**
   * Hook 2 — runs each time a node instance is created (including on load).
   * Catches anything that slipped through hook 1 (dynamic values, etc.).
   */
  nodeCreated(node) {
    sortNodeWidgets(node);
  },

  /**
   * Hook 3 — runs after the full graph is configured / a workflow is opened.
   * Belt-and-suspenders: re-sort every node on the canvas.
   */
  async afterConfigureGraph() {
    for (const node of app.graph._nodes ?? []) {
      sortNodeWidgets(node);
    }
  },

  /** Hook 4 — one-time startup log. */
  async setup() {
    console.log(`[AlphabeticalSort] Combo dropdowns will sort case-insensitively.`);
  },
});

// ---------------------------------------------------------------------------
// Visual tweak for the Python-backed node that appears in the menu
// ---------------------------------------------------------------------------

app.registerExtension({
  name: `${EXT_NAME}.NodeStyle`,

  async beforeRegisterNodeDef(nodeType, nodeData /*, app */) {
    if (nodeData.name !== "AlphabeticalSort") return;

    // Override onNodeCreated to style the node instance
    const onCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      onCreated?.apply(this, arguments);
      this.color   = "#1a3a2a";
      this.bgcolor = "#0f2419";
      this.size    = [240, 58];
    };

    // Draw a status label inside the node body
    const onDrawFg = nodeType.prototype.onDrawForeground;
    nodeType.prototype.onDrawForeground = function (ctx) {
      onDrawFg?.apply(this, arguments);
      ctx.save();
      ctx.font      = "bold 12px monospace";
      ctx.fillStyle = "#5dbe8a";
      ctx.textAlign = "center";
      ctx.fillText("✓ Dropdowns sorted A→Z", this.size[0] / 2, 34);
      ctx.restore();
    };
  },
});
