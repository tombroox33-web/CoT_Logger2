import json
import sys

try:
    import sentence_transformers
    print(json.dumps({"success": True, "installed": True}))
except ImportError:
    print(json.dumps({"success": True, "installed": False}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
