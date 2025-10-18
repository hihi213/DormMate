#!/usr/bin/env python3
"""
Simple helper to persist the current Codex workflow state.
The state file is a JSON document that records the active profile,
task identifier, loop step, last executed tests, and optional notes.
"""

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


def load_state(path: Path) -> dict:
    if path.exists():
        try:
            with path.open("r", encoding="utf-8") as fp:
                return json.load(fp)
        except json.JSONDecodeError:
            # Fallback to empty state if the file is corrupted.
            pass
    return {}


def main() -> None:
    parser = argparse.ArgumentParser(description="Update Codex workflow state.")
    parser.add_argument("--state-file", required=True, help="Path to state JSON file")
    parser.add_argument("--profile", help="Current Codex profile (design/stubs/review/brainstorm)")
    parser.add_argument("--task-id", help="Currently active Taskmaster ID (e.g., AUTH-01)")
    parser.add_argument("--loop-step", type=int, help="Current loop step (0-7)")
    parser.add_argument("--last-tests", help="Comma separated list of last executed test commands")
    parser.add_argument("--notes", help="Additional notes")
    args = parser.parse_args()

    state_path = Path(args.state_file)
    state_path.parent.mkdir(parents=True, exist_ok=True)

    state = load_state(state_path)

    if args.profile:
        state["current_profile"] = args.profile
    if args.task_id is not None:
        state["current_task_id"] = args.task_id
    if args.loop_step is not None:
        state["current_loop_step"] = args.loop_step
    if args.last_tests is not None:
        state["last_tests"] = args.last_tests
    if args.notes is not None:
        state["notes"] = args.notes

    state["updated_at"] = datetime.now(timezone.utc).isoformat()

    with state_path.open("w", encoding="utf-8") as fp:
        json.dump(state, fp, ensure_ascii=False, indent=2, sort_keys=True)


if __name__ == "__main__":
    main()
