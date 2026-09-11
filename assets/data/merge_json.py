#!/usr/bin/env python3
"""Merge two JSON files: recursive objects, concatenated arrays, second wins.

Usage:
    python3 assets/data/merge_json.py first.json second.json -o merged.json

Without -o, write to stdout. Arrays retain their order and duplicates.
For conflicting scalar values or different types, use the second value.
"""

import argparse
import json
import sys
from pathlib import Path


def merge(first, second):
    """Return the merged JSON value without modifying either input."""
    if isinstance(first, dict) and isinstance(second, dict):
        result = dict(first)
        for key, value in second.items():
            result[key] = merge(first[key], value) if key in first else value
        return result
    if isinstance(first, list) and isinstance(second, list):
        return first + second
    return second


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("first", type=Path, help="First JSON file")
    parser.add_argument("second", type=Path, help="Second JSON file (wins conflicts)")
    parser.add_argument("-o", "--output", type=Path, help="Output file (default: stdout)")
    args = parser.parse_args()

    try:
        first = json.loads(args.first.read_text(encoding="utf-8"))
        second = json.loads(args.second.read_text(encoding="utf-8"))
        output = json.dumps(merge(first, second), ensure_ascii=False, indent=2) + "\n"
        if args.output:
            args.output.write_text(output, encoding="utf-8")
        else:
            sys.stdout.write(output)
    except (OSError, ValueError) as error:
        parser.exit(1, f"Error: {error}\n")


if __name__ == "__main__":
    main()
