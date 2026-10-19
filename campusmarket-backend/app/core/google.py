"""Verify "Sign in with Google" ID tokens, on the server, with Google's published keys.

The browser hands us a signed token (a JWT) from Google. We trust it only if:
  * it's signed by one of Google's current keys (fetched from Google, cached),
  * it was issued by Google (iss) for OUR app (aud = GOOGLE_CLIENT_ID),
  * it hasn't expired,
  * Google says the email is verified.
"""

import jwt
from jwt import PyJWKClient

from app.core.config import settings

GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = ("accounts.google.com", "https://accounts.google.com")

_keys = PyJWKClient(GOOGLE_CERTS_URL, cache_keys=True, lifespan=3600)


class GoogleTokenError(ValueError):
    """Why a Google sign-in was refused (shown to the user)."""


def verify_google_token(credential: str) -> dict:
    if not settings.GOOGLE_CLIENT_ID:
        raise GoogleTokenError("Google sign-in isn't set up yet")
    try:
        key = _keys.get_signing_key_from_jwt(credential).key
        claims = jwt.decode(
            credential,
            key,
            algorithms=["RS256"],
            audience=settings.GOOGLE_CLIENT_ID,
            options={"require": ["exp", "iat", "iss", "aud", "sub"]},
            leeway=30,
        )
    except (jwt.PyJWTError, OSError) as e:
        raise GoogleTokenError("Google sign-in failed. Please try again.") from e
    if claims.get("iss") not in GOOGLE_ISSUERS:
        raise GoogleTokenError("Google sign-in failed. Please try again.")
    if claims.get("email_verified") is not True or not claims.get("email"):
        raise GoogleTokenError("Your Google account's email isn't verified")
    return claims
