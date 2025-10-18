#!/usr/bin/env python3
"""
Step 0 / Step 7 보조 리포트를 생성해 사용자가 확인만 하면 되도록 돕는 유틸리티.

- Step 0: SSOT 문서·Taskmaster 상태·Git 변경 사항을 요약
- Step 7: 현재 태스크 / 테스트 / 문서 업데이트 필요 항목을 정리
"""

from __future__ import annotations

import argparse
import json
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Optional


# --- 데이터 모델 -----------------------------------------------------------------


@dataclass
class TaskInfo:
    task_id: str
    title: str
    loop_step: Optional[int]
    required_tests: List[str]
    post_updates: List[str]
    file_path: Path


# --- 공통 유틸 -------------------------------------------------------------------


SSOT_DOCS = [
    "docs/service/service-definition.md",
    "docs/service/tech-guide.md",
    "docs/service/domain-model.md",
    "docs/service/feature-inventory.md",
    "docs/openapi/fridge-mvp.yaml",
]

NEXT_STEP_HINTS = {
    0: "Step 1(요구 재진술)부터 시작하세요.",
    1: "Step 2(단계/성공조건)을 작성하세요.",
    2: "Step 3(핵심 개념 설명)을 진행하세요.",
    3: "Step 4(주석 스켈레톤)를 생성하세요.",
    4: "Step 5(구현/리뷰)를 진행하세요.",
    5: "Step 6(필수 테스트 실행)을 진행하세요.",
    6: "Step 7(Taskmaster·문서 갱신)을 마무리하세요.",
    7: "모든 단계가 완료되었습니다. 다음 태스크를 선택하세요.",
}


def safe_int(value: object) -> Optional[int]:
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


def describe_next_action(current_step: Optional[int]) -> str:
    if current_step is None:
        return "loop_step 정보가 없어 Step 0 점검부터 진행하세요."
    return NEXT_STEP_HINTS.get(current_step, "Step 0 점검부터 다시 진행하세요.")


def resolve_config_path(project_root: Path) -> Optional[Path]:
    home_config = Path.home() / ".codex" / "config.toml"
    if home_config.exists():
        return home_config

    project_config = project_root / ".codex" / "config.toml"
    if project_config.exists():
        return project_config
    return None


def read_active_profile(config_path: Optional[Path]) -> Optional[str]:
    if config_path is None or not config_path.exists():
        return None
    try:
        for line in config_path.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("active_profile"):
                value = line.split("=", 1)[1]
                value = value.split("#", 1)[0]
                return value.strip().strip('"')
    except OSError:
        pass
    return None


def collect_git_status(project_root: Path, targets: Iterable[str]) -> List[str]:
    try:
        result = subprocess.run(
            ["git", "status", "--short", "--"] + list(targets),
            cwd=project_root,
            check=False,
            capture_output=True,
            text=True,
        )
    except OSError:
        return []

    lines = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    return lines


def parse_simple_yaml(path: Path) -> TaskInfo:
    task_id = ""
    title = ""
    loop_step: Optional[int] = None
    required_tests: List[str] = []
    post_updates: List[str] = []

    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return TaskInfo(task_id="", title="", loop_step=None, required_tests=[], post_updates=[], file_path=path)

    current_list: Optional[str] = None
    for raw_line in lines:
        line = raw_line.rstrip()
        if not line or line.strip().startswith("#"):
            continue
        if not line.startswith(" ") and ":" in line:
            key, value = line.split(":", 1)
            key = key.strip()
            value = value.strip()
            current_list = None

            if key == "id":
                task_id = value.strip()
            elif key == "title":
                title = value.strip()
            elif key == "loop_step":
                try:
                    loop_step = int(value)
                except ValueError:
                    loop_step = None
            elif key == "required_tests":
                current_list = "required_tests"
            elif key == "post_updates":
                current_list = "post_updates"
        elif current_list and line.strip().startswith("-"):
            item = line.split("-", 1)[1].strip()
            if current_list == "required_tests":
                required_tests.append(item)
            elif current_list == "post_updates":
                post_updates.append(item)

    return TaskInfo(
        task_id=task_id,
        title=title,
        loop_step=loop_step,
        required_tests=required_tests,
        post_updates=post_updates,
        file_path=path,
    )


def load_tasks(tasks_dir: Path) -> List[TaskInfo]:
    tasks: List[TaskInfo] = []
    if not tasks_dir.exists():
        return tasks
    for path in sorted(tasks_dir.glob("*.yaml")):
        if path.name.lower() == "readme.md":
            continue
        task = parse_simple_yaml(path)
        if task.task_id:
            tasks.append(task)
    return tasks


def load_state(state_file: Path) -> dict:
    if not state_file.exists():
        return {}
    try:
        return json.loads(state_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


# --- Step 0 ----------------------------------------------------------------------


def report_step_zero(project_root: Path) -> None:
    config_path = resolve_config_path(project_root)
    state_path = project_root / ".codex" / "state.json"
    state = load_state(state_path)
    tasks_dir = project_root / "docs" / "tasks"

    active_profile = read_active_profile(config_path)
    tasks = load_tasks(tasks_dir)
    pending = [task for task in tasks if task.loop_step is None or task.loop_step < 7]

    git_lines = collect_git_status(project_root, ["docs/service", "docs/openapi", "docs/tasks"])

    print("=== Step 0 SSOT 점검 리포트 ===")
    print(f"- 현재 active_profile: {active_profile or '확인 불가'}")

    state_task_id = state.get("current_task_id") if isinstance(state, dict) else None
    state_loop_step = safe_int(state.get("current_loop_step")) if isinstance(state, dict) else None
    summary_task = None
    if state_task_id:
        summary_task = next((task for task in tasks if task.task_id == state_task_id), None)
    task_loop_step = summary_task.loop_step if summary_task and isinstance(summary_task.loop_step, int) else None
    loop_candidates = [step for step in (state_loop_step, task_loop_step) if isinstance(step, int)]
    current_step = max(loop_candidates) if loop_candidates else None
    next_hint = describe_next_action(current_step)

    if state_task_id or summary_task:
        target_id = state_task_id or (summary_task.task_id if summary_task else None)
        title = summary_task.title if summary_task else "(Taskmaster에 등록되지 않은 태스크)"
        reported_step = current_step if current_step is not None else "미정"
        print(f"- 현재 집중 태스크: {target_id} (loop_step={reported_step}) — {title}")
        if state_task_id and summary_task and state_task_id != summary_task.task_id:
            print("  • state.json의 current_task_id와 Taskmaster가 일치하지 않습니다.")
        print(f"  • 다음 추천: {next_hint}")
    else:
        print("- 현재 집중 태스크가 지정되지 않았습니다.")
        print(f"  • 다음 추천: {next_hint}")

    print("- 우선 확인할 SSOT 문서:")
    for doc in SSOT_DOCS:
        mark = "[변경]" if any(doc in line for line in git_lines) else "[정상]"
        print(f"  {mark} {doc}")

    if pending:
        print("- 진행 중(Taskmaster loop_step < 7):")
        for task in pending:
            step = task.loop_step if task.loop_step is not None else "미정"
            print(f"  • {task.task_id} (loop_step={step}) — {task.title}")
    else:
        print("- 진행 중인 Taskmaster 항목이 없습니다.")

    if git_lines:
        print("- Git 변경 사항(문서/태스크 경로):")
        for line in git_lines:
            print(f"  {line}")
    else:
        print("- 문서 및 태스크 경로에 변경 사항이 감지되지 않았습니다.")

    print("- 권장 체크리스트:")
    print("  • Taskmaster preconditions 충족 여부 (필요 시 loop_step 0으로 재설정)")
    print("  • OpenAPI ↔ 서비스 문서 정책 일치")
    print("  • 최신 작업할 태스크 선택 및 `.codex/state.json` 갱신")
    test_sources = pending.copy()
    if summary_task and summary_task not in test_sources:
        test_sources.insert(0, summary_task)
    seen: set[str] = set()
    collected: List[str] = []
    for task in test_sources:
        for cmd in task.required_tests:
            if cmd not in seen:
                seen.add(cmd)
                collected.append(cmd)
    if collected:
        print("  • Step 6 테스트 준비 목록:")
        for cmd in collected:
            print(f"    - {cmd}")
    else:
        print("  • Step 6 테스트 준비 목록: (등록된 required_tests가 없습니다)")


# --- Step 7 ----------------------------------------------------------------------


def report_step_seven(project_root: Path) -> None:
    config_path = resolve_config_path(project_root)
    state_file = project_root / ".codex" / "state.json"
    tasks_dir = project_root / "docs" / "tasks"

    active_profile = read_active_profile(config_path)
    state = load_state(state_file)
    current_task_id = state.get("current_task_id")
    last_tests = state.get("last_tests", "")

    tasks = load_tasks(tasks_dir)
    task_lookup = {task.task_id: task for task in tasks}
    current_task = task_lookup.get(current_task_id) if current_task_id else None

    git_lines = collect_git_status(
        project_root,
        [
            "docs/service",
            "docs/openapi",
            "docs/tasks",
            "docs/checklist.md",
        ],
    )

    print("=== Step 7 Taskmaster/문서 갱신 리포트 ===")
    print(f"- 현재 active_profile: {active_profile or '확인 불가'}")
    print(f"- state.json current_task_id: {current_task_id or '미지정'}")
    if current_task:
        print(f"- Taskmaster loop_step: {current_task.loop_step} ({current_task.file_path.name})")
        print("- post_updates 후보:")
        if current_task.post_updates:
            for item in current_task.post_updates:
                mark = "[변경]" if any(item.split("#", 1)[0] in line for line in git_lines) else "[확인 필요]"
                print(f"  {mark} {item}")
        else:
            print("  (post_updates 미기재)")
    else:
        print("- 현재 태스크 정보를 찾을 수 없습니다. state.json 또는 docs/tasks/*.yaml을 확인하세요.")

    print("- 마지막으로 기록된 테스트 명령:")
    if last_tests:
        for cmd in (entry.strip() for entry in last_tests.split(",") if entry.strip()):
            print(f"  ✓ {cmd}")
    else:
        print("  (state.json에 last_tests 기록이 없습니다)")

    if git_lines:
        print("- 문서/체크리스트 변경 감지:")
        for line in git_lines:
            print(f"  {line}")
    else:
        print("- 문서/체크리스트에 추가 변경이 없습니다.")

    print("- Step 7 권장 절차:")
    print("  1) Taskmaster loop_step을 7로 갱신하고 post_updates 항목을 실제로 수정했는지 확인")
    print("  2) 문서 수정은 docs/service/_drafts/ 이하에 초안으로 남긴 뒤 PR/리뷰로 병합")
    print("  3) 실행한 테스트 로그를 state.json last_tests 또는 커밋 메시지에 기록")
    print("  4) 관련 문서(OpenAPI, 서비스 문서, 체크리스트) diff 확인 후 커밋 준비")


# --- CLI ------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Step 0 / Step 7 helper report")
    parser.add_argument("--project-root", type=Path, default=Path.cwd(), help="프로젝트 루트 (기본: 현재 디렉터리)")
    parser.add_argument("--step", choices=["0", "7"], required=True, help="생성할 리포트 (0 또는 7)")
    args = parser.parse_args()

    project_root = args.project_root.resolve()

    if args.step == "0":
        report_step_zero(project_root)
    elif args.step == "7":
        report_step_seven(project_root)
    else:
        parser.error("지원하지 않는 step 값입니다.")


if __name__ == "__main__":
    main()
