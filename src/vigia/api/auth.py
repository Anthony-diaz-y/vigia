"""Token-based access: a single configurable access token, no OAuth."""

from __future__ import annotations

from fastapi import HTTPException, Request


def require_token(request: Request) -> None:
    """Reject requests that do not carry the configured access token."""
    token = request.app.state.settings.access_token
    authorization = request.headers.get("Authorization", "")
    provided: str | None = None
    if authorization.startswith("Bearer "):
        provided = authorization[7:]
    else:
        provided = request.headers.get("X-Access-Token")

    if not provided or provided != token:
        raise HTTPException(status_code=401, detail="token de acceso inválido o ausente")
