"""Domain extraction and URL validation shared by sources, suggestions and imports."""

from __future__ import annotations

import re
from urllib.parse import urlsplit, urlunsplit

ALLOWED_SCHEMES = frozenset({"http", "https"})
_HOST_PATTERN = re.compile(
    r"^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$"
)


class InvalidUrl(ValueError):
    """The URL has no http(s) scheme or no usable host."""


def normalise_url(value: str) -> str:
    """Trim, add https:// when the scheme is missing, lower-case the host; raise InvalidUrl."""
    text = (value or "").strip()
    if not text:
        raise InvalidUrl("A URL is required.")
    if "://" not in text:
        if text.startswith("//"):
            text = "https:" + text
        else:
            text = "https://" + text
    parts = urlsplit(text)
    scheme = parts.scheme.lower()
    if scheme not in ALLOWED_SCHEMES:
        raise InvalidUrl("The URL must start with http:// or https://.")
    host = (parts.hostname or "").lower().strip(".")
    if not host or not _HOST_PATTERN.match(host):
        raise InvalidUrl("The URL has no valid host name.")
    netloc = host if parts.port is None else f"{host}:{parts.port}"
    return urlunsplit((scheme, netloc, parts.path or "/", parts.query, ""))


def domain_of(value: str) -> str:
    """Registrable host of a URL or bare domain, without a leading "www."."""
    host = urlsplit(normalise_url(value)).hostname or ""
    if host.startswith("www."):
        host = host[4:]
    return host


def normalise_domain(value: str) -> str:
    """Accepts a domain or a URL; always returns the lower-case host without "www."."""
    return domain_of(value)
