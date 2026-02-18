import tomllib
import sys

try:
    with open(".gemini/commands/refactor/surgical.toml", "rb") as f:
        tomllib.load(f)
    print("TOML is valid")
except Exception as e:
    print(f"TOML error: {e}")
