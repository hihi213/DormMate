#!/usr/bin/env python3
"""docs/tasks/*.yaml 간단 lint."""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Set

REQUIRED_FIELDS: Set[str] = {
    "id",
    "title",
    "loop_step",
    "preconditions",
    "refs",
    "required_tests",
    "post_updates",
    "acceptance",
}

LIST_FIELDS = {"preconditions", "refs", "required_tests", "post_updates", "acceptance"}


def parse_top_level_fields(lines: List[str]) -> Dict[str, str]:
    fields: Dict[str, str] = {}
    for line in lines:
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if line[0].isspace():
            continue
        if ":" not in line:
            continue
        key, rest = line.split(":", 1)
        fields[key.strip()] = rest.strip()
    return fields


def list_has_item(lines: List[str], key: str) -> bool:
    target = f"{key}:"
    for idx, line in enumerate(lines):
        if line.strip().startswith("#"):
            continue
        if not line.startswith(" ") and line.strip().startswith(target):
            j = idx + 1
            while j < len(lines) and (lines[j].startswith(" ") or not lines[j].strip()):
                if lines[j].lstrip().startswith("-"):
                    return True
                j += 1
            return False
    return False


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    tasks_dir = root / "docs" / "tasks"
    issues: List[str] = []

    for path in sorted(tasks_dir.glob("*.yaml")):
        if path.name.lower() == "readme.md":
            continue

        lines = path.read_text(encoding="utf-8").splitlines()
        fields = parse_top_level_fields(lines)

        missing = REQUIRED_FIELDS - fields.keys()
        if missing:
            issues.append(f"{path}: 누락 필드 -> {', '.join(sorted(missing))}")

        loop_raw = fields.get("loop_step")
        if loop_raw is None:
            issues.append(f"{path}: loop_step 없음")
        else:
            try:
                value = int(loop_raw)
                if value < 0 or value > 7:
                    issues.append(f"{path}: loop_step {value} (0~7 범위 벗어남)")
            except ValueError:
                issues.append(f"{path}: loop_step '{loop_raw}' 정수 아님")

        for lf in LIST_FIELDS:
            if lf not in fields:
                continue
            if not list_has_item(lines, lf):
                issues.append(f"{path}: {lf} 항목이 비어 있음")

    if issues:
        print("Taskmaster lint 실패:")
        for item in issues:
            print(f" - {item}")
        raise SystemExit(1)

    print("✅ Taskmaster lint: 모든 태스크가 규칙을 통과했습니다.")


if __name__ == "__main__":
    main()
