#!/usr/bin/env python3
"""
Taskmaster consistency guard.

역할
-----
1. `docs/service/service-definition.md`에서 `(작성 예정)` 표시가 없는 Taskmaster ID가
   실제 YAML(`docs/tasks/*.yaml`)로 존재하는지 확인한다.
2. 각 Task YAML이 필수 필드(`required_tests`, `post_updates`)를 비워두지 않았는지 검증한다.
3. `.codex/state.json`에 `current_task_id`와 `current_loop_step`이 명시돼 있으면,
   해당 Task YAML의 `loop_step`과 일치하는지 검사한다.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Set, Tuple


RE_TASK_REFERENCE = re.compile(r"Taskmaster:\s*([A-Z0-9-]+)(?![^|]*\(작성 예정\))")
TASKS_DIR = Path("docs/tasks")
SERVICE_DEFINITION = Path("docs/service/service-definition.md")
STATE_FILE = Path(".codex/state.json")


def ensure_pyyaml() -> None:
    try:
        import yaml  # noqa: F401
    except ImportError:
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "--user", "pyyaml"],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )


def load_yaml(path: Path) -> dict:
    import yaml  # type: ignore

    with path.open("r", encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


def required_task_ids() -> Set[str]:
    if not SERVICE_DEFINITION.exists():
        return set()

    content = SERVICE_DEFINITION.read_text(encoding="utf-8")
    return set(RE_TASK_REFERENCE.findall(content))


def iter_task_files() -> Iterable[Path]:
    if not TASKS_DIR.exists():
        return []
    for path in sorted(TASKS_DIR.glob("*.yaml")):
        yield path


def validate_task_yaml(path: Path) -> List[str]:
    issues: List[str] = []
    data = load_yaml(path)
    ident = data.get("id") or path.stem

    for field in ("required_tests", "post_updates"):
        value = data.get(field)
        if not isinstance(value, list) or not value or any(not isinstance(item, str) or not item.strip() for item in value):
            issues.append(f"{path}: 필수 필드 `{field}`가 비어있거나 문자열 목록이 아닙니다. (id={ident})")

    loop_step = data.get("loop_step")
    if not isinstance(loop_step, int) or not (0 <= loop_step <= 7):
        issues.append(f"{path}: loop_step은 0~7 범위의 정수여야 합니다. (id={ident}, value={loop_step!r})")

    return issues


def load_state() -> Tuple[Optional[str], Optional[int]]:
    if not STATE_FILE.exists():
        return None, None
    state_data = json.loads(STATE_FILE.read_text(encoding="utf-8"))
    return state_data.get("current_task_id"), state_data.get("current_loop_step")


def main() -> int:
    ensure_pyyaml()

    issues: List[str] = []
    required_ids = required_task_ids()
    available_ids: Dict[str, Path] = {}

    for path in iter_task_files():
        data = load_yaml(path)
        ident = data.get("id") or path.stem
        available_ids[ident] = path
        issues.extend(validate_task_yaml(path))

    missing = sorted(required_ids - set(available_ids.keys()))
    if missing:
        issues.append(
            "service-definition.md에서 작성 완료로 표시된 Taskmaster ID가 누락되었습니다: "
            + ", ".join(missing)
        )

    current_id, current_loop = load_state()
    if current_id and current_loop is not None:
        task_path = available_ids.get(current_id)
        if not task_path:
            issues.append(f".codex/state.json의 current_task_id({current_id})에 해당하는 Task YAML을 찾을 수 없습니다.")
        else:
            task_data = load_yaml(task_path)
            loop_step = task_data.get("loop_step")
            if loop_step != current_loop:
                issues.append(
                    f".codex/state.json의 current_loop_step({current_loop})과 "
                    f"{task_path}의 loop_step({loop_step})이 일치하지 않습니다."
                )

    if issues:
        print("❌ Taskmaster 검증 실패:", file=sys.stderr)
        for msg in issues:
            print(f"  - {msg}", file=sys.stderr)
        return 1

    print("✅ Taskmaster 검증 성공.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
