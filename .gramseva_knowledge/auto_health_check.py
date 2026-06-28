#!/usr/bin/env python3
"""Automated health check for the GramSeva Mitra AI memory librarian."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

MEMORY_ROOT = Path(__file__).resolve().parent
SCAN_DIRS = ("WIKI", "RAW", "OUTPUTS")


@dataclass
class DirectoryReport:
    name: str
    path: Path
    exists: bool = True
    files: list[Path] = field(default_factory=list)
    empty_files: list[Path] = field(default_factory=list)

    @property
    def file_count(self) -> int:
        return len(self.files)


def collect_files(directory: Path) -> list[Path]:
    if not directory.is_dir():
        return []
    return sorted(
        path for path in directory.rglob("*") if path.is_file()
    )


def scan_directory(name: str) -> DirectoryReport:
    directory = MEMORY_ROOT / name
    report = DirectoryReport(name=name, path=directory, exists=directory.is_dir())
    if not report.exists:
        return report

    report.files = collect_files(directory)
    report.empty_files = [path for path in report.files if path.stat().st_size == 0]
    return report


def relative_path(path: Path) -> str:
    try:
        return str(path.relative_to(MEMORY_ROOT))
    except ValueError:
        return str(path)


def print_section(title: str) -> None:
    line = "-" * len(title)
    print(f"\n{title}\n{line}")


def print_report(reports: list[DirectoryReport]) -> None:
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    print("=" * 60)
    print(" GramSeva Mitra — AI Memory Health Check")
    print("=" * 60)
    print(f"Root: {MEMORY_ROOT}")
    print(f"Generated: {generated_at}")

    print_section("Directory Summary")
    for report in reports:
        status = "missing" if not report.exists else f"{report.file_count} file(s)"
        print(f"  {report.name:<10} {status}")

    print_section("Empty Files")
    empty_found = False
    for report in reports:
        if not report.exists:
            continue
        for path in report.empty_files:
            empty_found = True
            print(f"  [{report.name}] {relative_path(path)}")
    if not empty_found:
        print("  None detected.")

    print_section("AI Contradictions / Flags")
    print("  (No automated checks configured yet.)")
    print("  Future passes will surface conflicting facts, stale entries,")
    print("  and items that need human review.")

    print("\n" + "=" * 60)
    print(" Health check complete.")
    print("=" * 60)


def main() -> int:
    reports = [scan_directory(name) for name in SCAN_DIRS]
    print_report(reports)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
