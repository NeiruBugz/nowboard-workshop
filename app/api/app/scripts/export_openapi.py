from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from app.main import app


def main() -> None:
    parser = argparse.ArgumentParser(description="Export FastAPI OpenAPI schema to JSON.")
    default_path = Path(__file__).resolve().parents[2] / "openapi.json"
    parser.add_argument(
        "path",
        nargs="?",
        default=str(default_path),
        help="Output path for openapi.json (default: app/api/openapi.json)",
    )
    args = parser.parse_args()

    output_path = Path(args.path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(app.openapi(), indent=2) + "\n")
    sys.stdout.write(f"Wrote OpenAPI schema to {output_path}\n")
