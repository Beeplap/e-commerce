"""Generate local secrets without printing them or replacing existing configuration."""

import secrets
from pathlib import Path


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    destination = root / ".env"
    template = (root / ".env.example").read_text(encoding="utf-8")
    lines = [
        f"{line.split('=', 1)[0]}={secrets.token_urlsafe(48)}"
        if line.endswith("=replace-with-generated-local-secret")
        else line
        for line in template.splitlines()
    ]
    try:
        with destination.open("x", encoding="utf-8", newline="\n") as file:
            file.write("\n".join(lines) + "\n")
        destination.chmod(0o600)
    except FileExistsError:
        print(".env already exists; preserved existing configuration.")
        return
    print("Created .env with fresh local secrets. Never commit this file.")


if __name__ == "__main__":
    main()
