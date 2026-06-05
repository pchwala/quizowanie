"""
Admin CLI to seed questions from a JSON file.

Usage:
    python -m app.seeds.load_questions --file data/1z10.json

Expected JSON format:
[
  {
    "text": "...",
    "answer": "...",
    "explanation": "...",         # optional
    "mnemonic": null,             # optional
    "source": "1z10_archive",
    "difficulty": 5,              # optional, 1-10
    "category_slug": "historia"
  }
]
"""

import argparse
import asyncio
import json
from pathlib import Path


async def load(file: Path) -> None:
    # TODO: open JSON, upsert categories, insert questions, skip duplicates
    raise NotImplementedError


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed questions from a JSON file.")
    parser.add_argument("--file", required=True, type=Path, help="Path to JSON file")
    args = parser.parse_args()
    asyncio.run(load(args.file))


if __name__ == "__main__":
    main()
