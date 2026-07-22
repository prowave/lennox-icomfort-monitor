#!/usr/bin/env python3
"""
Continuously poll a Lennox S30/E30 local API for messages, print them to the
screen, and log every message (one JSON object per line) to a file so you can
run this for days and hand the log off for later analysis.

Usage:
    pip install requests
    python3 lennox_poll.py 192.168.4.25

Optional:
    python3 lennox_poll.py 192.168.4.25 --app-id ha_diag_01 --alerts-only
    python3 lennox_poll.py 192.168.4.25 --log-file lennox_log.jsonl

Recommended for a multi-day run (survives closing the terminal):
    nohup python3 lennox_poll.py 192.168.4.25 --log-file lennox_log.jsonl > lennox_console.log 2>&1 &
"""
import argparse
import json
import ssl
import sys
import time
import uuid
from datetime import datetime

import requests
import urllib3
from requests.adapters import HTTPAdapter

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class LegacyTLSAdapter(HTTPAdapter):
    """The S30/E30 uses an old self-signed cert and cipher config that OpenSSL 3.x
    rejects at its default security level. Lower the security level and allow
    TLS 1.2 so the handshake succeeds, same as curl does out of the box."""

    def init_poolmanager(self, *args, **kwargs):
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        ctx.minimum_version = ssl.TLSVersion.TLSv1_2
        ctx.maximum_version = ssl.TLSVersion.TLSv1_2
        try:
            ctx.set_ciphers("DEFAULT:@SECLEVEL=0")
        except ssl.SSLError:
            ctx.set_ciphers("DEFAULT")
        kwargs["ssl_context"] = ctx
        return super().init_poolmanager(*args, **kwargs)

    def cert_verify(self, conn, url, verify, cert):
        super().cert_verify(conn, url, verify=False, cert=cert)


def ts() -> str:
    return datetime.now().strftime("%H:%M:%S")


def redact_message(msg: dict) -> dict:
    """Strips the plaintext WiFi password the S30 broadcasts in its `interfaces`
    telemetry, in place, before the message is logged or printed."""
    interfaces = msg.get("Data", {}).get("interfaces")
    if isinstance(interfaces, list):
        for iface in interfaces:
            ap_details = iface.get("Info", {}).get("APDetails", {})
            if "password" in ap_details:
                ap_details["password"] = "[redacted]"
    return msg


def connect(session: requests.Session, ip: str, app_id: str) -> None:
    url = f"https://{ip}/Endpoints/{app_id}/Connect"
    resp = session.post(url, verify=False, timeout=15)
    resp.raise_for_status()
    print(f"[{ts()}] Connected as app_id={app_id} ({resp.status_code})")


def request_data(session: requests.Session, ip: str, app_id: str, json_path: str) -> None:
    url = f"https://{ip}/Messages/RequestData"
    body = {
        "MessageType": "RequestData",
        "SenderID": app_id,
        "MessageID": str(uuid.uuid4()),
        "TargetID": "LCC",
        "AdditionalParameters": {"JSONPath": json_path},
    }
    resp = session.post(url, json=body, verify=False, timeout=15)
    resp.raise_for_status()
    print(f"[{ts()}] Subscribed to JSONPath: {json_path} -> {resp.text}")


def retrieve_once(session: requests.Session, ip: str, app_id: str, long_poll: int) -> list:
    url = f"https://{ip}/Messages/{app_id}/Retrieve"
    params = {
        "Direction": "Oldest-to-Newest",
        "MessageCount": "10",
        "StartTime": "1",
        "LongPollingTimeout": str(long_poll),
    }
    resp = session.get(url, params=params, verify=False, timeout=long_poll + 15)
    if resp.status_code == 204:
        return []
    resp.raise_for_status()
    data = resp.json()
    return data.get("messages", [])


def reconnect(session: requests.Session, ip: str, app_id: str, json_path: str) -> bool:
    try:
        connect(session, ip, app_id)
        request_data(session, ip, app_id, json_path)
        return True
    except requests.exceptions.RequestException as e:
        print(f"[{ts()}] Reconnect failed: {e}", file=sys.stderr)
        return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Poll a Lennox S30/E30 local API, print and log messages.")
    parser.add_argument("ip", help="IP address of the S30/E30 (e.g. 192.168.4.25)")
    parser.add_argument("--app-id", default="ha_diag_01", help="Unique application id to register")
    parser.add_argument("--long-poll", type=int, default=10, help="LongPollingTimeout seconds per request")
    parser.add_argument(
        "--json-path",
        default="1;/systemControl;/alerts/active;/alerts/meta;/equipments;/system",
        help="JSONPath subscription to request",
    )
    parser.add_argument("--alerts-only", action="store_true", help="Shortcut: subscribe only to alerts")
    parser.add_argument(
        "--log-file",
        default="lennox_log.jsonl",
        help="File to append every message to, one JSON object per line (default: lennox_log.jsonl)",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Don't print (no new messages) heartbeat lines to the console",
    )
    args = parser.parse_args()

    json_path = "1;/alerts/active;/alerts/meta" if args.alerts_only else args.json_path

    session = requests.Session()
    session.mount("https://", LegacyTLSAdapter())

    try:
        connect(session, args.ip, args.app_id)
        request_data(session, args.ip, args.app_id, json_path)
    except requests.exceptions.RequestException as e:
        print(f"Failed to connect/subscribe: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"[{ts()}] Polling... logging to {args.log_file} - press Ctrl+C to stop\n")

    consecutive_failures = 0

    with open(args.log_file, "a", buffering=1) as log_f:
        try:
            while True:
                try:
                    messages = retrieve_once(session, args.ip, args.app_id, args.long_poll)
                    consecutive_failures = 0
                except requests.exceptions.RequestException as e:
                    consecutive_failures += 1
                    print(f"[{ts()}] Retrieve failed: {e} - retrying in 5s", file=sys.stderr)
                    time.sleep(5)
                    # The S30's network stack is known to reset daily, which can kill
                    # the session. After a few failures in a row, re-establish it.
                    if consecutive_failures >= 3:
                        print(f"[{ts()}] Multiple failures - reconnecting session...", file=sys.stderr)
                        if reconnect(session, args.ip, args.app_id, json_path):
                            consecutive_failures = 0
                    continue

                if not messages:
                    if not args.quiet:
                        print(f"[{ts()}] (no new messages)")
                    continue

                for msg in messages:
                    redact_message(msg)
                    line = {"logged_at": datetime.now().isoformat(), "message": msg}
                    log_f.write(json.dumps(line) + "\n")
                    print(f"[{ts()}] {json.dumps(msg, indent=2)}")
        except KeyboardInterrupt:
            print("\nStopped.")


if __name__ == "__main__":
    main()
