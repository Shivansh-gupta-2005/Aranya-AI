"""Convert a TFLite model into an Arduino C header."""

from __future__ import annotations

import argparse
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("model", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    data = args.model.read_bytes()
    rows = [
        ", ".join(f"0x{value:02x}" for value in data[index : index + 12])
        for index in range(0, len(data), 12)
    ]
    content = (
        "#pragma once\n\n"
        "#include <cstddef>\n"
        "#include <cstdint>\n\n"
        "alignas(16) const unsigned char kAranyaModel[] = {\n  "
        + ",\n  ".join(rows)
        + "\n};\n"
        + f"constexpr size_t kAranyaModelSize = {len(data)};\n"
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(content, encoding="ascii")


if __name__ == "__main__":
    main()
