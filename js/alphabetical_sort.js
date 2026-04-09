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
 *  4. fetch() intercept — rgthree's Power Lora Loader fetches its lora list
 *     directly from the backend at runtime rather than using standard combo
 *     widgets. We intercept those responses and sort them at the source so
 *     rgthree's own picker displays them in order.
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
    // Always restore the original value — if the model/lora isn't in the list
    // (e.g. loading a workflow with missing assets) we must leave it as-is so
    // ComfyUI can highlight it as missing, just like it does without this extension.
    w.value = current;
  }
}

// ---------------------------------------------------------------------------
// rgthree Power Lora Loader — fetch() intercept
//
// rgthree does not use standard ComfyUI combo widgets. Instead its lora slots
// are fully custom widgets (type: "custom") that fetch the lora list directly
// from the backend at runtime via their own API calls. The selected value is
// stored as w._value.lora, and the picker list is built fresh from the fetch
// response each time the user opens the dropdown.
//
// Because there is no widget.options.values array to sort, we must intercept
// the fetch() calls that supply that list and sort the data at the source.
//
// rgthree fetches from two possible endpoints:
//   • /rgthree/loras          — rgthree's own lora-info endpoint (returns [{name, ...}])
//   • /object_info            — standard ComfyUI node-info endpoint (returns node defs)
//
// We wrap the global fetch once, detect those URLs, parse + sort the response,
// then hand back a synthetic Response so the caller never knows we intervened.
// ---------------------------------------------------------------------------

function installFetchIntercept() {
  const _fetch = window.fetch.bind(window);

  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : input?.url ?? "";

    // ── rgthree /rgthree/api/loras ──────────────────────────────────────────
    // Response shape: [{file, path, modified, ...}, ...]
    // rgthreeApi.getLoras() fetches this, caches the promise, then
    // showLoraChooser maps it via loras.map(l => l.file) to build the picker.
    // Sorting here means the cached promise already contains sorted data so
    // every picker opened from it will be in order.
    if (url.includes("/rgthree/api/loras")) {
      const response = await _fetch(input, init);
      const clone    = response.clone();
      try {
        const data = await clone.json();
        if (Array.isArray(data)) {
          data.sort((a, b) =>
            String(a.file ?? a).localeCompare(String(b.file ?? b), undefined, { sensitivity: "base" })
          );
        }
        return new Response(JSON.stringify(data), {
          status:  response.status,
          headers: response.headers,
        });
      } catch {
        return response;
      }
    }

    // ── /object_info (covers LoraLoader and similar standard nodes) ─────────
    // Response shape: { NodeTypeName: { input: { required: { lora_name: [[...], {}] } } } }
    // This is also what beforeRegisterNodeDef sorts, but intercepting here
    // catches any runtime refresh calls that bypass that hook.
    if (url.includes("/object_info")) {
      const response = await _fetch(input, init);
      const clone    = response.clone();
      try {
        const data = await clone.json();
        for (const nodeDef of Object.values(data)) {
          sortNodeDataCombos(nodeDef);
        }
        return new Response(JSON.stringify(data), {
          status:  response.status,
          headers: response.headers,
        });
      } catch {
        return response;
      }
    }

    return _fetch(input, init);
  };

  console.log("[AlphabeticalSort] fetch() intercept installed for rgthree lora endpoints.");
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

  /**
   * Hook 4 — one-time startup: install the fetch intercept and log.
   * setup() runs before any nodes are registered, so the intercept is in
   * place before rgthree makes its first /rgthree/loras call.
   */
  async setup() {
    installFetchIntercept();
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