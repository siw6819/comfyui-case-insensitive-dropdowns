"""
alphabetical_sort — ComfyUI Custom Node
Patches all combo (dropdown) widgets to sort case-insensitively.
Drop the "Alphabetical Sort" node anywhere in a workflow to make the effect
explicit, but the JS extension applies globally as soon as the folder is
installed — no node required.
"""

# ---------------------------------------------------------------------------
# Python-backed node (gives us an entry in the Add Node menu)
# ---------------------------------------------------------------------------

class AlphabeticalSortNode:
    """A no-op utility node whose only job is to document that
    the alphabetical-sort extension is active in this workflow."""

    @classmethod
    def INPUT_TYPES(cls):
        return {}          # no inputs needed

    RETURN_TYPES = ()      # no outputs
    FUNCTION     = "run"
    CATEGORY     = "utils"
    OUTPUT_NODE  = True    # won't be pruned as "unused" by the scheduler

    def run(self):
        return {}


# ---------------------------------------------------------------------------
# ComfyUI registration
# ---------------------------------------------------------------------------

NODE_CLASS_MAPPINGS = {
    "AlphabeticalSort": AlphabeticalSortNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AlphabeticalSort": "Alphabetical Sort 🔤",
}

# Tell ComfyUI to serve every .js file in the ./js sub-directory
WEB_DIRECTORY = "./js"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
