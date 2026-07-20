from __future__ import annotations

import os
import time

_CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"


def new_ulid() -> str:
    """Generates a ULID: 48-bit millisecond timestamp + 80 bits of randomness,
    encoded as 26 Crockford-base32 characters (lexicographically sortable)."""
    timestamp_ms = int(time.time() * 1000)
    randomness = os.urandom(10)
    value = (timestamp_ms << 80) | int.from_bytes(randomness, "big")

    chars = []
    for _ in range(26):
        value, remainder = divmod(value, 32)
        chars.append(_CROCKFORD_ALPHABET[remainder])
    return "".join(reversed(chars))
