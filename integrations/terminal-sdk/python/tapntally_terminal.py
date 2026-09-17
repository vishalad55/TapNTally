"""TapNTally terminal reference client (Python 3.9+, standard library only).

    from tapntally_terminal import build_bill, sign_bill, ndef_payload, push_bill

    bill = build_bill(bill_id="RF-KOR-000123", merchant={...}, terminal={...}, items=[...])
    signed = sign_bill(bill, terminal_secret)
    push_bill(api_base, api_key, pairing_code, signed)

Canonical JSON matches the Node and server implementations: keys sorted
recursively, no whitespace, None values omitted, UTF-8 unescaped.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any

MIME = "application/vnd.tapntally.bill+json"


def _strip_none(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: _strip_none(v) for k, v in value.items() if v is not None}
    if isinstance(value, list):
        return [_strip_none(v) for v in value]
    return value


def canonical_json(bill: dict) -> str:
    body = {k: v for k, v in bill.items() if k != "sig"}
    return json.dumps(_strip_none(body), sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sign_bill(bill: dict, terminal_secret: str) -> dict:
    digest = hmac.new(terminal_secret.encode("utf-8"), canonical_json(bill).encode("utf-8"), hashlib.sha256).digest()
    return {**bill, "sig": base64.b64encode(digest).decode("ascii")}


def verify_bill(bill: dict, terminal_secret: str) -> bool:
    if not bill.get("sig"):
        return False
    expected = hmac.new(terminal_secret.encode("utf-8"), canonical_json(bill).encode("utf-8"), hashlib.sha256).digest()
    return hmac.compare_digest(base64.b64decode(bill["sig"]), expected)


def build_bill(
    *,
    bill_id: str,
    merchant: dict,
    terminal: dict,
    items: list[dict],
    tax_rupees: float = 0,
    discount_rupees: float = 0,
    payment_method: str = "unknown",
    issued_at: datetime | None = None,
) -> dict:
    """Amounts in rupees in; integer paise out, with totals that always reconcile."""

    def paise(r: float) -> int:
        return int(round(float(r) * 100))

    lines = []
    for it in items:
        unit = paise(it["unit_rupees"])
        line = {"name": it["name"], "qty": it["qty"], "unitPaise": unit, "totalPaise": int(round(unit * it["qty"]))}
        if it.get("sku"):
            line["sku"] = it["sku"]
        if it.get("gst_rate") is not None:
            line["gstRate"] = it["gst_rate"]
        lines.append(line)
    subtotal = sum(l["totalPaise"] for l in lines)
    tax, discount = paise(tax_rupees), paise(discount_rupees)
    when = issued_at or datetime.now(timezone.utc)
    return {
        "v": 1,
        "billId": bill_id,
        "issuedAt": when.isoformat(),
        "currency": "INR",
        "merchant": merchant,
        "terminal": terminal,
        "items": lines,
        "subtotalPaise": subtotal,
        "taxPaise": tax,
        "discountPaise": discount,
        "totalPaise": subtotal + tax - discount,
        "paymentMethod": payment_method,
    }


def ndef_payload(bill: dict) -> bytes:
    """One MIME NDEF record: MB=1, ME=1, TNF=0x02."""
    type_bytes = MIME.encode("ascii")
    payload = json.dumps(bill, ensure_ascii=False).encode("utf-8")
    short = len(payload) < 256
    flags = 0x80 | 0x40 | (0x10 if short else 0) | 0x02
    length = bytes([len(payload)]) if short else len(payload).to_bytes(4, "big")
    return bytes([flags, len(type_bytes)]) + length + type_bytes + payload


def push_bill(api_base: str, api_key: str, pairing_code: str, bill: dict, timeout: float = 15) -> dict:
    req = urllib.request.Request(
        f"{api_base.rstrip('/')}/partner/bills",
        data=json.dumps({"pairingCode": pairing_code, "bill": bill}).encode("utf-8"),
        headers={"content-type": "application/json", "x-partner-key": api_key},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        raise RuntimeError(f"TapNTally rejected the bill ({e.code}): {body}") from None


if __name__ == "__main__":
    import argparse
    import sys

    p = argparse.ArgumentParser(description="TapNTally terminal client")
    p.add_argument("command", choices=["sign", "push"])
    p.add_argument("--bill", required=True)
    p.add_argument("--secret")
    p.add_argument("--api")
    p.add_argument("--key")
    p.add_argument("--code")
    a = p.parse_args()
    with open(a.bill, encoding="utf-8") as f:
        bill = json.load(f)
    if a.secret:
        bill = sign_bill(bill, a.secret)
    if a.command == "sign":
        json.dump(bill, sys.stdout, indent=2, ensure_ascii=False)
    else:
        print(json.dumps(push_bill(a.api, a.key, a.code, bill), indent=2))
