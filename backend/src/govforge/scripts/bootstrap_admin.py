"""Bootstrap the first admin user + token (Phase 3.0 Stage A).

The API requires a valid Bearer token on every write endpoint, but the
`/tokens` POST endpoint itself requires a token to call it. This script
breaks the chicken-and-egg by writing directly to the DB.

Usage on the deploy host:

    podman exec -it govforge-backend \\
        python -m govforge.scripts.bootstrap_admin --email eric@example.com

The plaintext token is printed to stdout exactly once. Save it somewhere
secure (1Password, ~/.config/govforge/auth.toml). It is unrecoverable
after this run.

If a user with the same email already exists, the script reuses it and
adds a new admin token (idempotent for the user, additive for tokens).
"""

from __future__ import annotations

import argparse
import sys
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from govforge.api.auth import (
    generate_token_secret,
    hash_token_secret,
    extract_prefix,
)
from govforge.core.enums import AgentType, TokenScope
from govforge.core.models import ApiToken, User
from govforge.db.session import make_engine, make_session_factory, create_all


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--email",
        required=True,
        help="Admin email. Reused if a user already exists with that email.",
    )
    parser.add_argument(
        "--display-name",
        default=None,
        help="Optional human-readable name attached to the user.",
    )
    parser.add_argument(
        "--label",
        default="bootstrap-admin",
        help="Label stored on the ApiToken row (visible in /tokens listings).",
    )
    parser.add_argument(
        "--expires-in-days",
        type=int,
        default=None,
        help="If set, token expires after N days. Default: never.",
    )
    parser.add_argument(
        "--ensure-tables",
        action="store_true",
        help="Run create_all() before inserting (useful on a fresh DB).",
    )
    args = parser.parse_args(argv)

    engine = make_engine()
    if args.ensure_tables:
        create_all(engine)

    session_factory = make_session_factory(engine)
    with session_factory() as session:
        user = session.scalar(select(User).where(User.email == args.email))
        if user is None:
            user = User(email=args.email, display_name=args.display_name)
            session.add(user)
            session.flush()
            print(f"created user: {user.email} (id={user.id})", file=sys.stderr)
        else:
            print(f"reusing user: {user.email} (id={user.id})", file=sys.stderr)

        secret = generate_token_secret()
        token = ApiToken(
            user_id=user.id,
            label=args.label,
            agent_type=AgentType.HUMAN,
            prefix=extract_prefix(secret),
            hashed_secret=hash_token_secret(secret),
        )
        token.scopes = [TokenScope.ADMIN]
        if args.expires_in_days is not None:
            token.expires_at = datetime.now(UTC) + timedelta(days=args.expires_in_days)
        session.add(token)
        session.commit()
        print(f"created token: id={token.id} label={token.label}", file=sys.stderr)

    # Plaintext token to stdout — and ONLY stdout, so the operator can pipe
    # it into a secret store: `bootstrap_admin --email … > /tmp/tok` works.
    print(secret)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
