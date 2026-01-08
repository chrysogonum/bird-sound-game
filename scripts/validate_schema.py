#!/usr/bin/env python3
"""
Validate JSON data against a JSON schema.

Usage:
    python validate_schema.py --schema <schema_file> --data <data_file>
"""

import argparse
import json
import sys
from pathlib import Path

try:
    import jsonschema
    from jsonschema import validate, ValidationError
except ImportError:
    print("ERROR: jsonschema package not installed. Run: pip install jsonschema")
    sys.exit(1)


def load_json(file_path: str) -> dict:
    """Load JSON from file."""
    with open(file_path, 'r') as f:
        return json.load(f)


def validate_schema(schema_path: str, data_path: str) -> bool:
    """Validate data against schema."""
    try:
        schema = load_json(schema_path)
        data = load_json(data_path)

        validate(instance=data, schema=schema)
        print(f"VALID: {data_path} conforms to {schema_path}")
        return True

    except ValidationError as e:
        print(f"INVALID: {data_path}")
        print(f"  Error: {e.message}")
        print(f"  Path: {' -> '.join(str(p) for p in e.absolute_path)}")
        return False

    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON in file")
        print(f"  {e}")
        return False

    except FileNotFoundError as e:
        print(f"ERROR: File not found: {e.filename}")
        return False


def main():
    parser = argparse.ArgumentParser(description='Validate JSON data against schema')
    parser.add_argument('--schema', required=True, help='Path to JSON schema file')
    parser.add_argument('--data', required=True, help='Path to JSON data file')

    args = parser.parse_args()

    success = validate_schema(args.schema, args.data)
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
