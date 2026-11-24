"""Error tracking with Sentry: every crash (and every ERROR log line, e.g. storage or email
outages) is sent to Sentry, which emails you, with the stack trace and the request's path.

Off unless SENTRY_DSN is set (so local development and tests send nothing).

Privacy: nothing that identifies a student is sent. No IP addresses, cookies, login tokens,
user details or request bodies (bodies hold passwords and login codes). Only the method, path,
query string and the error itself.
"""

import os

from app.core.config import settings

# Request headers that could identify someone or carry their session.
_PRIVATE_HEADERS = {"authorization", "cookie", "x-forwarded-for", "x-real-ip", "cf-connecting-ip", "true-client-ip"}


def scrub(event: dict, hint: dict | None = None) -> dict:
    """Last check before an event leaves the server (Sentry's before_send hook)."""
    event.pop("user", None)
    # Belt and braces with include_local_variables=False: no frame variables, ever.
    for exc in (event.get("exception") or {}).get("values") or []:
        for frame in (exc.get("stacktrace") or {}).get("frames") or []:
            frame.pop("vars", None)
    for thread in (event.get("threads") or {}).get("values") or []:
        for frame in (thread.get("stacktrace") or {}).get("frames") or []:
            frame.pop("vars", None)
    request = event.get("request")
    if isinstance(request, dict):
        request.pop("cookies", None)
        request.pop("data", None)
        request.pop("env", None)  # includes the client's IP address
        headers = request.get("headers")
        if isinstance(headers, dict):
            for name in [h for h in headers if h.lower() in _PRIVATE_HEADERS]:
                headers.pop(name)
    return event


def setup_sentry() -> bool:
    """Start Sentry if it's configured. Returns whether it's on."""
    if not settings.SENTRY_DSN:
        return False
    import sentry_sdk

    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        release=os.environ.get("RENDER_GIT_COMMIT"),  # set by Render: which deploy the error came from
        send_default_pii=False,
        max_request_body_size="never",
        # Stack traces would otherwise carry every frame's local variables, which include login
        # passwords, request bodies and session tokens (found when testing this).
        include_local_variables=False,
        traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
        before_send=scrub,
    )
    return True
