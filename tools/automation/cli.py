#!/usr/bin/env python3
"""Unified automation CLI for the DormMate project.

기존 Makefile · shell 스크립트를 대체해 7-스텝 루프에서 필요한
명령을 일관적으로 제공한다. 모든 명령은 프로젝트 루트에서 실행한다.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Optional


PROJECT_ROOT = Path(__file__).resolve().parents[2]
STATE_PATH = PROJECT_ROOT / ".codex" / "state.json"
OPENAPI_SEED = PROJECT_ROOT / "docs" / "openapi" / "fridge-mvp.yaml"
BUILD_DIR = PROJECT_ROOT / "build"
CLIENT_DIR = PROJECT_ROOT / "client"
BACKEND_DIR = PROJECT_ROOT / "backend"


@dataclass
class CommandResult:
    command: Iterable[str]
    returncode: int


def run_command(
    command: Iterable[str],
    *,
    cwd: Optional[Path] = None,
    env: Optional[dict[str, str]] = None,
    check: bool = True,
) -> CommandResult:
    """Execute a subprocess while echoing the command."""
    cmd_list = list(command)
    display_cwd = f"[{cwd}]" if cwd else ""
    print(f"$ {' '.join(cmd_list)} {display_cwd}".rstrip())
    base_env = load_env_cache()
    merged_env = base_env.copy()
    if env:
        merged_env.update(env)
    completed = subprocess.run(cmd_list, cwd=cwd, env=merged_env, check=check)
    return CommandResult(command=cmd_list, returncode=completed.returncode)


# ---------------------------------------------------------------------------
# Codex state helpers
# ---------------------------------------------------------------------------


def load_state() -> dict:
    if STATE_PATH.exists():
        try:
            return json.loads(STATE_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            print("⚠️  state.json을 파싱할 수 없어 새로 생성합니다.")
    return {}


def persist_state(**updates: object) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    state = load_state()
    for key, value in updates.items():
        if value is None:
            continue
        state[key] = value
    state["updated_at"] = datetime.now(timezone.utc).isoformat()
    STATE_PATH.write_text(
        json.dumps(state, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def show_state() -> None:
    state = load_state()
    if not state:
        print("ℹ️  state.json이 아직 생성되지 않았습니다.")
        return
    print("=== Codex 상태 ===")
    for key in ("current_profile", "current_task_id", "current_loop_step", "last_tests", "notes", "updated_at"):
        value = state.get(key, "-")
        print(f"{key:>18}: {value}")


# ---------------------------------------------------------------------------
# Environment helpers
# ---------------------------------------------------------------------------

_ENV_CACHE: Optional[dict[str, str]] = None


def load_env_cache() -> dict[str, str]:
    """Load .env (if present) once and reuse for all subprocess calls."""
    global _ENV_CACHE
    if _ENV_CACHE is not None:
        return _ENV_CACHE

    env = os.environ.copy()
    env_path = PROJECT_ROOT / ".env"
    if env_path.exists():
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("export "):
                line = line[len("export ") :].strip()
            if "=" not in line:
                continue
            key, value = line.split("=", 1)
            env[key.strip()] = value.strip()
    _ENV_CACHE = env
    return _ENV_CACHE


# ---------------------------------------------------------------------------
# Command implementations
# ---------------------------------------------------------------------------


def cmd_tests_core(args: argparse.Namespace) -> None:
    print("▶️  Step 6 핵심 테스트 번들을 실행합니다.")
    spectral()
    gradle_tests(clean=True)
    npm_tests()
    playwright_smoke()
    if args.full_playwright:
        playwright_full()
    persist_state(last_tests="python tools/automation/cli.py tests core")
    print("✅ tests core 완료")


def spectral() -> None:
    run_command(
        [
            "npx",
            "@stoplight/spectral-cli",
            "lint",
            str(OPENAPI_SEED),
            "--ruleset",
            ".spectral.yaml",
        ]
    )


def gradle_tests(*, clean: bool) -> None:
    cmd = ["./gradlew"]
    if clean:
        cmd.append("clean")
    cmd.append("test")
    run_command(cmd, cwd=BACKEND_DIR)


def npm_tests() -> None:
    run_command(["npm", "test"], cwd=CLIENT_DIR)


def playwright_smoke() -> None:
    command = ["npm", "run", "playwright:test", "--", "--grep", "@smoke"]
    env = load_env_cache()
    process = subprocess.run(
        command,
        cwd=CLIENT_DIR,
        env=env,
        text=True,
        capture_output=True,
    )
    if process.stdout:
        sys.stdout.write(process.stdout)
    if process.stderr:
        sys.stderr.write(process.stderr)
    if process.returncode != 0:
        combined = (process.stdout or "") + (process.stderr or "")
        if "No tests found" in combined:
            print("ℹ️  Playwright @smoke 테스트가 없어 스킵했습니다.")
            return
        raise subprocess.CalledProcessError(process.returncode, command)


def playwright_full() -> None:
    run_command(["npm", "run", "playwright:test"], cwd=CLIENT_DIR)


def cmd_tests_backend(_: argparse.Namespace) -> None:
    gradle_tests(clean=False)
    persist_state(last_tests="python tools/automation/cli.py tests backend")


def cmd_tests_frontend(_: argparse.Namespace) -> None:
    npm_tests()
    persist_state(last_tests="python tools/automation/cli.py tests frontend")


def cmd_tests_playwright(args: argparse.Namespace) -> None:
    if args.full:
        playwright_full()
        label = "python tools/automation/cli.py tests playwright --full"
    else:
        playwright_smoke()
        label = "python tools/automation/cli.py tests playwright"
    persist_state(last_tests=label)


def cmd_openapi_lint(_: argparse.Namespace) -> None:
    spectral()


def cmd_openapi_diff(args: argparse.Namespace) -> None:
    print("⚠️  openapi diff 명령은 현재 비활성화되었습니다. OpenAPI 3.1을 지원하는 도구가 준비되면 다시 안내드릴게요.")


def cmd_db_migrate(_: argparse.Namespace) -> None:
    run_command(["docker", "compose", "run", "--rm", "migrate"])


def cmd_dev_up(args: argparse.Namespace) -> None:
    services = args.services or ["db", "redis", "pgadmin"]
    run_command(["docker", "compose", "up", "-d", *services])


def cmd_dev_down(_: argparse.Namespace) -> None:
    run_command(["docker", "compose", "down"])


def cmd_dev_status(_: argparse.Namespace) -> None:
    run_command(["docker", "compose", "ps"])


def cmd_dev_backend(_: argparse.Namespace) -> None:
    print("ℹ️  Spring Boot 서버를 실행합니다. 종료하려면 Ctrl+C.")
    run_command(["./gradlew", "bootRun"], cwd=BACKEND_DIR, check=False)


def cmd_dev_frontend(_: argparse.Namespace) -> None:
    print("ℹ️  Next.js 개발 서버를 실행합니다. 종료하려면 Ctrl+C.")
    run_command(["npm", "run", "dev"], cwd=CLIENT_DIR, check=False)


def cmd_cleanup(_: argparse.Namespace) -> None:
    targets = [
        PROJECT_ROOT / "backend" / "build",
        CLIENT_DIR / ".next",
        CLIENT_DIR / "out",
        CLIENT_DIR / "dist",
        PROJECT_ROOT / "artifacts",
    ]
    for path in targets:
        if path.exists():
            if path.is_dir():
                shutil.rmtree(path)
            else:
                path.unlink()
    print("🧹 정리 완료")


def cmd_state_show(_: argparse.Namespace) -> None:
    show_state()


def cmd_state_update(args: argparse.Namespace) -> None:
    persist_state(
        current_profile=args.profile,
        current_task_id=args.task,
        current_loop_step=args.loop_step,
        last_tests=args.last_tests,
        notes=args.notes,
    )
    show_state()


# ---------------------------------------------------------------------------
# Parser configuration
# ---------------------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="DormMate Automation CLI")
    subparsers = parser.add_subparsers(dest="command")

    # tests
    tests = subparsers.add_parser("tests", help="테스트 명령")
    tests_sub = tests.add_subparsers(dest="tests_command")

    tests_core = tests_sub.add_parser("core", help="Spectral+백엔드+프론트+Playwright 스모크")
    tests_core.add_argument("--full-playwright", action="store_true", help="Playwright 전체 테스트까지 실행")
    tests_core.set_defaults(func=cmd_tests_core)

    tests_backend = tests_sub.add_parser("backend", help="Gradle 테스트만 실행")
    tests_backend.set_defaults(func=cmd_tests_backend)

    tests_frontend = tests_sub.add_parser("frontend", help="프론트엔드 테스트만 실행")
    tests_frontend.set_defaults(func=cmd_tests_frontend)

    tests_playwright = tests_sub.add_parser("playwright", help="Playwright 스모크 또는 전체 실행")
    tests_playwright.add_argument("--full", action="store_true", help="Playwright 전체 테스트 실행")
    tests_playwright.set_defaults(func=cmd_tests_playwright)

    # openapi
    openapi = subparsers.add_parser("openapi", help="OpenAPI 관련 명령")
    openapi_sub = openapi.add_subparsers(dest="openapi_command")

    openapi_lint = openapi_sub.add_parser("lint", help="Spectral lint 실행")
    openapi_lint.set_defaults(func=cmd_openapi_lint)

    openapi_diff = openapi_sub.add_parser("diff", help="(비활성화) Seed와 런타임 명세 diff")
    openapi_diff.add_argument(
        "--url",
        default="http://localhost:8080/v3/api-docs",
        help="런타임 OpenAPI를 가져올 URL (기본: %(default)s)",
    )
    openapi_diff.set_defaults(func=cmd_openapi_diff)

    # db
    db = subparsers.add_parser("db", help="데이터베이스 관련 명령")
    db_sub = db.add_subparsers(dest="db_command")

    db_migrate = db_sub.add_parser("migrate", help="Flyway 마이그레이션 실행")
    db_migrate.set_defaults(func=cmd_db_migrate)

    # dev
    dev = subparsers.add_parser("dev", help="개발 환경 제어")
    dev_sub = dev.add_subparsers(dest="dev_command")

    dev_up = dev_sub.add_parser("up", help="도커 서비스 기동")
    dev_up.add_argument("--services", nargs="+", help="기동할 서비스 지정 (기본: db redis pgadmin)")
    dev_up.set_defaults(func=cmd_dev_up)

    dev_down = dev_sub.add_parser("down", help="도커 서비스 중지")
    dev_down.set_defaults(func=cmd_dev_down)

    dev_status = dev_sub.add_parser("status", help="도커 서비스 상태 확인")
    dev_status.set_defaults(func=cmd_dev_status)

    dev_backend = dev_sub.add_parser("backend", help="Spring Boot dev 서버 실행")
    dev_backend.set_defaults(func=cmd_dev_backend)

    dev_frontend = dev_sub.add_parser("frontend", help="Next.js dev 서버 실행")
    dev_frontend.set_defaults(func=cmd_dev_frontend)

    # 기타
    cleanup = subparsers.add_parser("cleanup", help="빌드 산출물 정리")
    cleanup.set_defaults(func=cmd_cleanup)

    state = subparsers.add_parser("state", help="Codex 상태 조회/갱신")
    state_sub = state.add_subparsers(dest="state_command")

    state_show = state_sub.add_parser("show", help="state.json 조회")
    state_show.set_defaults(func=cmd_state_show)

    state_update = state_sub.add_parser("update", help="state.json 갱신")
    state_update.add_argument("--profile", help="현재 프로필 (develop/wrap-up 등)")
    state_update.add_argument("--task", help="현재 Taskmaster ID")
    state_update.add_argument("--loop-step", type=int, help="현재 7-스텝 단계(0-7)")
    state_update.add_argument("--last-tests", help="최근 실행한 테스트 커맨드")
    state_update.add_argument("--notes", help="비고/메모")
    state_update.set_defaults(func=cmd_state_update)

    return parser


def main(argv: Optional[list[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    func = getattr(args, "func", None)
    if func is None:
        parser.print_help()
        return 1
    try:
        func(args)
    except subprocess.CalledProcessError as exc:
        return exc.returncode
    except KeyboardInterrupt:
        print("\n⏹ 작업이 사용자의 요청으로 중단되었습니다.")
        return 130
    return 0


if __name__ == "__main__":
    sys.exit(main())
