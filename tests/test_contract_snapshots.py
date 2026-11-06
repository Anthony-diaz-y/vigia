"""The committed goldens must be reproducible from the Python oracle.

Regenerate intentionally with::

    uv run python -m tools.contract_snapshots
"""

from __future__ import annotations

from pathlib import Path

from tools.contract_snapshots import generate_snapshots

COMMITTED = Path(__file__).resolve().parents[1] / "contract" / "snapshots"


def test_committed_snapshots_match_python_oracle(tmp_path: Path) -> None:
    generated = generate_snapshots(tmp_path / "snapshots")

    generated_files = sorted(
        path.relative_to(generated) for path in generated.rglob("*") if path.is_file()
    )
    committed_files = sorted(
        path.relative_to(COMMITTED) for path in COMMITTED.rglob("*") if path.is_file()
    )
    assert generated_files == committed_files

    for relative in generated_files:
        assert (generated / relative).read_bytes() == (
            COMMITTED / relative
        ).read_bytes(), f"snapshot drift: {relative}"
