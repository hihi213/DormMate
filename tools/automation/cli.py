#!/usr/bin/env python3
"""Unified automation CLI for the DormMate project.

기존 Makefile · shell 스크립트를 대체해 스텝 루프에서 필요한
명령을 일관적으로 제공한다. 모든 명령은 프로젝트 루트에서 실행한다.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import signal
import subprocess
import sys
import textwrap
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Optional


PROJECT_ROOT = Path(__file__).resolve().parents[2]
STATE_PATH = PROJECT_ROOT / ".codex" / "state.json"
BUILD_DIR = PROJECT_ROOT / "build"
FRONTEND_DIR = PROJECT_ROOT / "frontend"
BACKEND_DIR = PROJECT_ROOT / "backend"
JAVA_HOME_DEFAULT = Path.home() / "Library/Java/JavaVirtualMachines/ms-21.0.8/Contents/Home"
GRADLE_CACHE_DIR = PROJECT_ROOT / ".gradle-cache"
NODE_CACHE_ROOT = PROJECT_ROOT / ".cache" / "node"
DEFAULT_DEV_PORTS = (3000, 3001, 3002, 3003, 8080)


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


def run_gradle_task(
    *tasks: str,
    clean: bool = False,
    check: bool = True,
    offline: bool = False,
    refresh: bool = False,
) -> CommandResult:
    cmd = ["./gradlew"]
    if offline:
        cmd.append("--offline")
    if refresh:
        cmd.append("--refresh-dependencies")
    if clean:
        cmd.append("clean")
    cmd.extend(tasks)
    return run_command(cmd, cwd=BACKEND_DIR, check=check)


def run_npm_command(*args: str, check: bool = True) -> CommandResult:
    return run_command(["npm", *args], cwd=FRONTEND_DIR, check=check)


def npm_install() -> None:
    run_npm_command("install")


def npm_playwright_install() -> None:
    run_npm_command("run", "playwright:install")


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
_ENV_WARNING_EMITTED = False
_JAVA_WARNING_EMITTED = False
_NODE_WARNING_EMITTED = False


def _detect_node_bin() -> Optional[Path]:
    if not NODE_CACHE_ROOT.exists():
        return None
    for candidate in sorted(NODE_CACHE_ROOT.iterdir(), reverse=True):
        bin_dir = candidate / "bin"
        if bin_dir.is_dir():
            return bin_dir
    return None


def load_env_cache() -> dict[str, str]:
    """Load .env (if present) once and reuse for all subprocess calls."""
    global _ENV_CACHE, _ENV_WARNING_EMITTED, _JAVA_WARNING_EMITTED, _NODE_WARNING_EMITTED
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
    elif not _ENV_WARNING_EMITTED:
        print("ℹ️  .env 파일이 없어 기본 시스템 환경 변수를 사용합니다.")
        _ENV_WARNING_EMITTED = True

    path_entries = env.get("PATH", "").split(os.pathsep) if env.get("PATH") else []

    java_home = env.get("JAVA_HOME")
    java_home_path = Path(java_home) if java_home else JAVA_HOME_DEFAULT
    java_bin_path = java_home_path / "bin"
    if java_bin_path.is_dir():
        env["JAVA_HOME"] = str(java_home_path)
        if str(java_bin_path) not in path_entries:
            path_entries.insert(0, str(java_bin_path))
    elif not _JAVA_WARNING_EMITTED:
        print("⚠️  JAVA_HOME 경로를 찾을 수 없어 기본 Gradle 테스트가 실패할 수 있습니다.")
        print(f"    확인된 경로: {java_home_path}")
        _JAVA_WARNING_EMITTED = True

    if "GRADLE_USER_HOME" not in env:
        env["GRADLE_USER_HOME"] = str(GRADLE_CACHE_DIR)
    Path(env["GRADLE_USER_HOME"]).mkdir(parents=True, exist_ok=True)

    node_bin_dir = _detect_node_bin()
    if node_bin_dir:
        node_bin_str = str(node_bin_dir)
        if node_bin_str not in path_entries:
            path_entries.insert(0, node_bin_str)
    elif not _NODE_WARNING_EMITTED:
        print("ℹ️  .cache/node 아래에서 Node.js 바이너리를 찾지 못했습니다. 시스템 PATH를 사용합니다.")
        _NODE_WARNING_EMITTED = True

    if path_entries:
        env["PATH"] = os.pathsep.join(path_entries)

    _ENV_CACHE = env
    return _ENV_CACHE


# ---------------------------------------------------------------------------
# Command implementations
# ---------------------------------------------------------------------------


def cmd_tests_core(args: argparse.Namespace) -> None:
    print("▶️  Step 6 핵심 테스트 번들을 실행합니다.")
    if args.skip_backend:
        print("↪️  백엔드 테스트를 건너뜁니다.")
    else:
        gradle_tests(clean=True)

    if args.skip_frontend:
        print("↪️  프론트엔드 테스트를 건너뜁니다.")
    else:
        npm_lint()

    if args.skip_playwright:
        print("↪️  Playwright 테스트를 건너뜁니다.")
    else:
        if args.full_playwright:
            playwright_full()
        else:
            playwright_smoke()

    persist_state(last_tests="auto tests core")
    print("✅ tests core 완료")


def gradle_tests(*, clean: bool) -> None:
    offline_first = os.environ.get("DM_GRADLE_OFFLINE_FIRST", "1") != "0"
    if offline_first:
        result = run_gradle_task("test", clean=clean, offline=True, check=False)
        if result.returncode == 0:
            return
        print("ℹ️  오프라인 실행이 실패해 의존성을 새로 고칩니다.")
        run_gradle_task("test", clean=clean, refresh=True)
        return

    run_gradle_task("test", clean=clean)


def npm_lint() -> None:
    run_npm_command("run", "lint")


def playwright_smoke() -> None:
    run_playwright(smoke_only=True)


def run_playwright(smoke_only: bool, allow_empty: bool = True) -> None:
    command: list[str] = ["npm", "run", "playwright:test"]
    if smoke_only:
        command.extend(["--", "--grep", "@smoke"])
    print(f"$ {' '.join(command)} [{FRONTEND_DIR}]")
    env = load_env_cache()
    process = subprocess.run(
        command,
        cwd=FRONTEND_DIR,
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
        if allow_empty and "No tests found" in combined:
            print("ℹ️  Playwright 테스트가 없어 스킵했습니다.")
            return
        raise subprocess.CalledProcessError(process.returncode, command)


def playwright_full() -> None:
    run_playwright(smoke_only=False, allow_empty=False)


def cmd_dev_warmup(args: argparse.Namespace) -> None:
    refresh = getattr(args, "refresh", False)
    print("▶️  Gradle warmup (help task)")
    run_gradle_task("help", refresh=refresh)

    print("▶️  Download backend dependencies (testClasses)")
    run_gradle_task("testClasses", refresh=True)

    print("▶️  Install frontend packages")
    npm_install()

    if getattr(args, "with_playwright", False):
        print("▶️  Install Playwright browsers")
        npm_playwright_install()
    else:
        print("ℹ️  Playwright 브라우저 설치를 건너뜁니다. 필요 시 --with-playwright 옵션을 사용하세요.")

    print("✅ 개발 환경 예열 완료")


def cmd_tests_backend(_: argparse.Namespace) -> None:
    gradle_tests(clean=False)
    run_gradle_task("flywayInfo")
    persist_state(last_tests="auto tests backend")


def cmd_tests_frontend(_: argparse.Namespace) -> None:
    npm_lint()
    persist_state(last_tests="auto tests frontend")


def cmd_tests_playwright(args: argparse.Namespace) -> None:
    if args.full:
        playwright_full()
        label = "auto tests playwright --full"
    else:
        playwright_smoke()
        label = "auto tests playwright"
    persist_state(last_tests=label)


def cmd_db_migrate(_: argparse.Namespace) -> None:
    print("ℹ️  Gradle Flyway 마이그레이션을 실행합니다.")
    run_gradle_task("flywayMigrate")


def cmd_dev_up(args: argparse.Namespace) -> None:
    services = args.services or ["db", "redis"]
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
    run_command(["npm", "run", "dev"], cwd=FRONTEND_DIR, check=False)


def _pid_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def _collect_pids_for_port(port: int) -> set[int]:
    result = subprocess.run(
        ["lsof", "-ti", f"tcp:{port}"],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode not in (0, 1):
        stderr = result.stderr.strip()
        if stderr:
            print(f"⚠️  포트 {port} 조사 중 lsof 오류: {stderr}")
        return set()
    if not result.stdout.strip():
        return set()
    return {int(pid) for pid in result.stdout.split()}


def _build_port_process_map(ports: Iterable[int]) -> dict[int, set[int]]:
    port_processes: dict[int, set[int]] = {}
    for port in ports:
        pids = _collect_pids_for_port(port)
        if pids:
            port_processes[port] = pids
    return port_processes


def cmd_dev_kill_ports(args: argparse.Namespace) -> None:
    resolved_ports: list[int] = []
    if args.ports:
        for raw in args.ports:
            try:
                resolved_ports.append(int(raw))
            except ValueError:
                print(f"⚠️  무시된 포트 값: {raw}")
    else:
        resolved_ports.extend(DEFAULT_DEV_PORTS)
        print("ℹ️  포트를 지정하지 않아 기본 포트 목록을 사용합니다:", ", ".join(str(p) for p in resolved_ports))

    if not resolved_ports:
        print("ℹ️  종료할 포트가 지정되지 않았습니다.")
        return

    try:
        port_processes = _build_port_process_map(resolved_ports)
    except FileNotFoundError:
        print("⚠️  lsof 명령을 찾을 수 없습니다. 포트 정리를 수행하려면 lsof를 설치하세요.")
        return

    if not port_processes:
        print("ℹ️  대상 포트에서 실행 중인 프로세스를 찾지 못했습니다.")
        return

    pid_to_ports: dict[int, set[int]] = {}
    for port, pids in port_processes.items():
        for pid in pids:
            pid_to_ports.setdefault(pid, set()).add(port)

    if not pid_to_ports:
        print("ℹ️  대상 포트에서 실행 중인 프로세스를 찾지 못했습니다.")
        return

    print("🔍 종료 대상 프로세스:")
    for pid, port_set in pid_to_ports.items():
        ports_str = ", ".join(str(p) for p in sorted(port_set))
        print(f"  - PID {pid} (ports: {ports_str})")

    permission_denied: set[int] = set()
    for pid in pid_to_ports:
        try:
            os.kill(pid, signal.SIGTERM)
            print(f"⏹  PID {pid}에 SIGTERM 전송")
        except ProcessLookupError:
            print(f"ℹ️  PID {pid}는 이미 종료되었습니다.")
        except PermissionError:
            permission_denied.add(pid)
            print(f"⚠️  PID {pid}에 대한 종료 권한이 없습니다.")

    time.sleep(0.5)
    still_running = [
        pid for pid in pid_to_ports if pid not in permission_denied and _pid_alive(pid)
    ]

    if still_running:
        print("💥 SIGTERM 이후에도 실행 중인 프로세스를 강제 종료합니다.")
        for pid in still_running:
            try:
                os.kill(pid, signal.SIGKILL)
                print(f"💥  PID {pid}에 SIGKILL 전송")
            except ProcessLookupError:
                print(f"ℹ️  PID {pid}는 이미 종료되었습니다.")
            except PermissionError:
                permission_denied.add(pid)
                print(f"⚠️  PID {pid}에 대한 강제 종료 권한이 없습니다.")

    lingering = [
        pid for pid in pid_to_ports if pid not in permission_denied and _pid_alive(pid)
    ]
    if lingering:
        print("⚠️  일부 프로세스를 종료하지 못했습니다:")
        for pid in lingering:
            ports_str = ", ".join(str(p) for p in sorted(pid_to_ports[pid]))
            print(f"  - PID {pid} (ports: {ports_str})")
        print("    수동으로 종료하거나 관리자 권한이 필요한지 확인하세요.")
    else:
        print("✅ 지정된 포트의 프로세스를 정리했습니다.")

    if permission_denied:
        denied_str = ", ".join(str(pid) for pid in sorted(permission_denied))
        print(f"⚠️  다음 PID는 권한 부족으로 종료하지 못했습니다: {denied_str}")


def cmd_cleanup(_: argparse.Namespace) -> None:
    targets = [
        PROJECT_ROOT / "backend" / "build",
        FRONTEND_DIR / ".next",
        FRONTEND_DIR / "out",
        FRONTEND_DIR / "dist",
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


def print_top_level_summary(parser: argparse.ArgumentParser) -> None:
    parser.print_help()
    summary = """
자주 쓰는 명령 요약
  ./auto dev warmup [--refresh] [--with-playwright]  Gradle·Node 의존성 예열 (필요 시 Playwright)
  ./auto dev up                      개발용 Docker 서비스 기동
  ./auto dev down                    개발용 Docker 서비스 중지
  ./auto dev status                  개발용 Docker 서비스 상태 확인
  ./auto dev backend                 Spring Boot 서버 실행
  ./auto dev frontend                Next.js 개발 서버 실행
  ./auto dev kill-ports              지정한 포트(기본 3000~3003, 8080) 정리
  ./auto tests core                  백엔드·프론트·Playwright 테스트 번들
  ./auto tests backend               백엔드 테스트만 실행
  ./auto tests frontend              프론트엔드 Lint 실행
  ./auto tests playwright [--full]   Playwright 스모크/전체 실행
  ./auto db migrate                  Flyway 마이그레이션
  ./auto cleanup                     빌드 산출물 정리

세부 옵션은 각 명령 뒤에 `--help`를 붙여 확인하세요. 예) `./auto dev --help`, `./auto tests core --help`
"""
    print(textwrap.dedent(summary).strip())


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "DormMate Automation CLI\n"
            "\n"
            "주요 플로우 예시:\n"
            "  ./auto dev warmup [--refresh] [--with-playwright]  # Gradle/Node 캐시 및 (옵션) Playwright 설치\n"
            "  ./auto dev up                  # 개발용 Docker 서비스 기동\n"
            "  ./auto dev backend             # Spring Boot 서버 실행\n"
            "  ./auto dev kill-ports          # 지정한 포트를 한 번에 정리\n"
            "  ./auto tests core              # 백엔드·프론트·Playwright 번들 테스트\n"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    subparsers = parser.add_subparsers(dest="command", metavar="command")

    # tests
    tests = subparsers.add_parser("tests", help="테스트 명령")
    tests_sub = tests.add_subparsers(dest="tests_command", metavar="tests-command")

    tests_core = tests_sub.add_parser("core", help="백엔드+프론트+Playwright 테스트 번들 실행")
    tests_core.add_argument("--skip-backend", action="store_true", help="Gradle 테스트를 건너뜀")
    tests_core.add_argument("--skip-frontend", action="store_true", help="프론트엔드 테스트를 건너뜀")
    tests_core.add_argument("--skip-playwright", action="store_true", help="Playwright 테스트를 건너뜀")
    tests_core.add_argument("--full-playwright", action="store_true", help="Playwright 전체 테스트까지 실행")
    tests_core.set_defaults(func=cmd_tests_core)

    tests_backend = tests_sub.add_parser("backend", help="Gradle 테스트만 실행")
    tests_backend.set_defaults(func=cmd_tests_backend)

    tests_frontend = tests_sub.add_parser("frontend", help="프론트엔드 정적 점검(lint) 실행")
    tests_frontend.set_defaults(func=cmd_tests_frontend)

    tests_playwright = tests_sub.add_parser("playwright", help="Playwright 스모크 또는 전체 실행")
    tests_playwright.add_argument("--full", action="store_true", help="Playwright 전체 테스트 실행")
    tests_playwright.set_defaults(func=cmd_tests_playwright)

    # db
    db = subparsers.add_parser("db", help="데이터베이스 관련 명령")
    db_sub = db.add_subparsers(dest="db_command")

    db_migrate = db_sub.add_parser("migrate", help="Flyway 마이그레이션 실행")
    db_migrate.set_defaults(func=cmd_db_migrate)

    # dev
    dev = subparsers.add_parser("dev", help="개발 환경 제어")
    dev_sub = dev.add_subparsers(dest="dev_command", metavar="dev-command")

    dev_warmup = dev_sub.add_parser("warmup", help="Gradle/Node 캐시 예열 (옵션: Playwright)")
    dev_warmup.add_argument("--refresh", action="store_true", help="Gradle 의존성을 강제로 갱신합니다.")
    dev_warmup.add_argument("--with-playwright", action="store_true", help="Playwright 브라우저까지 설치합니다.")
    dev_warmup.set_defaults(func=cmd_dev_warmup)

    dev_up = dev_sub.add_parser("up", help="도커 서비스 기동")
    dev_up.add_argument("--services", nargs="+", help="기동할 서비스 지정 (기본: db redis)")
    dev_up.set_defaults(func=cmd_dev_up)

    dev_down = dev_sub.add_parser("down", help="도커 서비스 중지")
    dev_down.set_defaults(func=cmd_dev_down)

    dev_status = dev_sub.add_parser("status", help="도커 서비스 상태 확인")
    dev_status.set_defaults(func=cmd_dev_status)

    dev_backend = dev_sub.add_parser("backend", help="Spring Boot dev 서버 실행")
    dev_backend.set_defaults(func=cmd_dev_backend)

    dev_frontend = dev_sub.add_parser("frontend", help="Next.js dev 서버 실행")
    dev_frontend.set_defaults(func=cmd_dev_frontend)

    dev_kill_ports = dev_sub.add_parser("kill-ports", help="지정한 포트(기본 3000~3003, 8080) 정리")
    dev_kill_ports.add_argument(
        "--ports",
        nargs="+",
        help=f"정리할 포트 목록 (기본: {', '.join(str(p) for p in DEFAULT_DEV_PORTS)})",
    )
    dev_kill_ports.set_defaults(func=cmd_dev_kill_ports)

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
        print_top_level_summary(parser)
        return 0
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
