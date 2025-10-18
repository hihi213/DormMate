#!/usr/bin/env python3
"""
CI guard: verifies that pull requests document Step 6 테스트 체크리스트.

조건
------
* PR 본문에 `## Step 6 Checklist` 섹션이 존재해야 한다.
* `make tests-core` 항목이 체크 박스(`[x]`)로 완료 표시되어야 한다.
* 아직 체크하지 않은 기본 항목(`- [ ] make tests-core`)이 남아 있으면 실패한다.

이 스크립트는 `GITHUB_EVENT_PATH`에서 PR 메타데이터를 읽어 검사한다.
push 이벤트 등 PR이 아닌 경우에는 성공으로 빠르게 종료한다.
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path


def load_event() -> dict:
    event_path = os.getenv("GITHUB_EVENT_PATH")
    if not event_path:
        print("GITHUB_EVENT_PATH not set; skipping Step 6 checklist validation.", file=sys.stderr)
        sys.exit(0)

    path = Path(event_path)
    if not path.exists():
        print(f"GITHUB_EVENT_PATH does not exist: {path}", file=sys.stderr)
        sys.exit(0)

    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def main() -> int:
    event = load_event()
    pr = event.get("pull_request")
    if pr is None:
        # push 이벤트 등은 검사 대상 아님
        print("Not a pull request event; skipping Step 6 checklist validation.", file=sys.stderr)
        return 0

    body = pr.get("body") or ""
    if "## Step 6 Checklist" not in body:
        print("❌ PR 본문에 '## Step 6 Checklist' 섹션이 없습니다.", file=sys.stderr)
        return 1

    pattern_checked = re.compile(r"-\s*\[[xX]\]\s*make\s+tests-core")
    pattern_unchecked = re.compile(r"-\s*\[\s*\]\s*make\s+tests-core")

    has_checked = bool(pattern_checked.search(body))
    has_unchecked = bool(pattern_unchecked.search(body))

    if has_unchecked and not has_checked:
        print("❌ Step 6 체크리스트에서 `make tests-core` 항목이 미체크 상태입니다.", file=sys.stderr)
        return 1

    if not has_checked:
        print("❌ Step 6 체크리스트에 `- [x] make tests-core` 완료 표시가 필요합니다.", file=sys.stderr)
        return 1

    print("✅ Step 6 체크리스트 검증 성공.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
