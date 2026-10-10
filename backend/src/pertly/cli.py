"""
Command line administration for Pertly (`uv run pertly --help`, or `pertly` inside the backend container).
"""

import argparse
import getpass
import json
import sqlite3
import sys
from pathlib import Path

from pertly.common.config import settings
from pertly.common.db import connect, prepare_database
from pertly.domains.estimate.desktop_import import DesktopImportService
from pertly.domains.user.model import UserCreate
from pertly.domains.user.service import UserService, email_is_valid, password_is_valid


def _fail(message: str) -> None:
    print(f"error: {message}", file=sys.stderr)
    raise SystemExit(1)


def create_admin(args: argparse.Namespace) -> None:
    password = args.password or getpass.getpass("Password: ")
    if not args.password and password != getpass.getpass("Repeat password: "):
        _fail("passwords do not match.")
    if not email_is_valid(args.email):
        _fail("invalid email format.")
    if not password_is_valid(password):
        _fail("password needs at least 8 characters, a digit, a lower-case and an upper-case letter.")

    connection = connect()
    try:
        user_service = UserService(db_session=connection)
        if user_service.user_mail_exist_already(mail=args.email):
            _fail(f"a user with email {args.email} already exists.")
        user = user_service.create_new_user(
            UserCreate(
                first_name=args.first_name, last_name=args.last_name, email=args.email, password=password, is_admin=True
            )
        )
    finally:
        connection.close()
    print(f"Admin {user.email} created.")


def import_json(args: argparse.Namespace) -> None:
    try:
        store = json.loads(Path(args.file).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        _fail(f"could not read {args.file}: {error}")
    if not isinstance(store, dict) or not isinstance(store.get("estimates", []), list):
        _fail("file is not a Pertly Desktop estimates.json.")

    connection = connect()
    try:
        user = UserService(db_session=connection).get_user_by_mail(args.email)
        if not user:
            _fail(f"no user with email {args.email}.")
        result = DesktopImportService(db_session=connection).import_store(
            user_id=user.id, store=store, replace_settings=args.replace_settings
        )
    finally:
        connection.close()
    print(
        f"Imported {result.imported} estimate(s), skipped {result.skipped}. "
        f"Settings imported: {'yes' if result.settings_imported else 'no'}."
    )


def backup(args: argparse.Namespace) -> None:
    """Consistent online copy via SQLite's backup API (safe while the app is running, unlike `cp`)."""
    target_path = Path(args.out)
    target_path.parent.mkdir(parents=True, exist_ok=True)
    if target_path.exists():
        _fail(f"{target_path} already exists.")
    source = connect()
    target = sqlite3.connect(target_path)
    try:
        source.backup(target)
    finally:
        target.close()
        source.close()
    print(f"Backup of {settings.database_path} written to {target_path}.")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="pertly", description="Pertly administration.")
    commands = parser.add_subparsers(dest="command", required=True)

    admin_parser = commands.add_parser("create-admin", help="Create an administrator account.")
    admin_parser.add_argument("--email", required=True)
    admin_parser.add_argument("--first-name", default="Admin")
    admin_parser.add_argument("--last-name", default="User")
    admin_parser.add_argument("--password", help="Omit to be prompted (recommended).")
    admin_parser.set_defaults(handler=create_admin)

    import_parser = commands.add_parser("import-json", help="Import a Pertly Desktop estimates.json for a user.")
    import_parser.add_argument("--file", required=True)
    import_parser.add_argument("--email", required=True, help="Account that receives the estimates.")
    import_parser.add_argument(
        "--replace-settings",
        action="store_true",
        help="Overwrite the user's existing default settings with the file's.",
    )
    import_parser.set_defaults(handler=import_json)

    backup_parser = commands.add_parser("backup", help="Write a consistent copy of the database.")
    backup_parser.add_argument("--out", required=True)
    backup_parser.set_defaults(handler=backup)
    return parser


def main(argv: list[str] | None = None) -> None:
    args = build_parser().parse_args(argv)
    prepare_database()
    args.handler(args)


if __name__ == "__main__":
    main()
