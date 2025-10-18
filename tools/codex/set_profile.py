#!/usr/bin/env python3
"""Utility to switch Codex active_profile quickly."""

from __future__ import annotations

import argparse
import pathlib
import re
import sys


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Update Codex active_profile")
    parser.add_argument("profile", help="Profile name (design, stubs, review, brainstorm, ...)")
    parser.add_argument(
        "--config",
        type=pathlib.Path,
        default=pathlib.Path.home() / ".codex" / "config.toml",
        help="Path to config.toml (default: ~/.codex/config.toml)",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    config_path: pathlib.Path = args.config.expanduser().resolve()

    if not config_path.exists():
        print(f"[set_profile] config not found: {config_path}", file=sys.stderr)
        return 1

    try:
        content = config_path.read_text(encoding="utf-8")
    except OSError as exc:
        print(f"[set_profile] failed to read {config_path}: {exc}", file=sys.stderr)
        return 1

    profile_marker = f"[profiles.{args.profile}]"
    if profile_marker not in content:
        print(f"[set_profile] profile '{args.profile}' not defined in config", file=sys.stderr)
        return 1

    pattern = re.compile(r'^active_profile\s*=\s*".*?"', re.MULTILINE)
    if not pattern.search(content):
        print("[set_profile] active_profile line not found", file=sys.stderr)
        return 1

    updated = pattern.sub(f'active_profile = "{args.profile}"', content, count=1)

    try:
        config_path.write_text(updated, encoding="utf-8")
    except OSError as exc:
        print(f"[set_profile] failed to write {config_path}: {exc}", file=sys.stderr)
        return 1

    print(f"[set_profile] active_profile set to '{args.profile}' in {config_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
