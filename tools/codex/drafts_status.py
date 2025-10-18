#!/usr/bin/env python3
"""docs/service/_drafts/** 초안과 본문 문서 동기화 상태를 확인한다."""

from __future__ import annotations

from pathlib import Path


def main() -> None:
    project_root = Path(__file__).resolve().parents[2]
    drafts_dir = project_root / "docs" / "service" / "_drafts"
    service_dir = project_root / "docs" / "service"

    if not drafts_dir.exists():
        print("초안 디렉터리가 없습니다: docs/service/_drafts/")
        return

    draft_files = sorted(p for p in drafts_dir.rglob("*") if p.is_file() and p.name != ".gitkeep")
    if not draft_files:
        print("처리할 초안이 없습니다.")
        return

    print("=== Drafts vs Published 문서 상태 ===")
    for draft in draft_files:
        rel_path = draft.relative_to(drafts_dir)
        published = service_dir / rel_path

        if not published.exists():
            print(f"[MISSING] {rel_path.as_posix()} → 본문 문서가 없습니다.")
            continue

        try:
            draft_text = draft.read_text(encoding="utf-8")
            published_text = published.read_text(encoding="utf-8")
        except OSError as exc:
            print(f"[ERROR] {rel_path.as_posix()} 읽기 실패: {exc}")
            continue

        if draft_text == published_text:
            print(f"[SYNCED] {rel_path.as_posix()}")
        else:
            print(f"[DIFF]   {rel_path.as_posix()} → 본문과 내용이 다릅니다.")


if __name__ == "__main__":
    main()
