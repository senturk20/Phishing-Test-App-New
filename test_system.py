"""
Phishing Simulation - End-to-End System Test
=============================================
Tests the full pipeline: LDAP users -> Campaign -> Sync -> Start -> Email dispatch

Prerequisites:
  - All Docker containers running (docker compose up -d)

Usage:
  py test_system.py
"""

import json
import subprocess
import sys
import urllib.request
import urllib.error
import time

# ============================================
# CONFIGURATION
# ============================================

BACKEND_URL = "http://localhost:8080"
MAILHOG_URL = "http://localhost:8025"

LDAP_ADMIN_DN = "cn=admin,dc=university,dc=edu,dc=tr"
LDAP_ADMIN_PW = "admin"
LDAP_BASE_DN = "dc=university,dc=edu,dc=tr"
LDAP_CONTAINER = "phishing-ldap"

CAMPAIGN_NAME = "Automated Lab Test"

LDAP_USERS = [
    {
        "uid": "ahmet.yilmaz",
        "givenName": "Ahmet",
        "sn": "Yilmaz",
        "uidNumber": "1001",
        "mail": "ahmet.yilmaz@university.edu.tr",
    },
    {
        "uid": "mehmet.demir",
        "givenName": "Mehmet",
        "sn": "Demir",
        "uidNumber": "1002",
        "mail": "mehmet.demir@university.edu.tr",
    },
    {
        "uid": "ayse.kaya",
        "givenName": "Ayse",
        "sn": "Kaya",
        "uidNumber": "1003",
        "mail": "ayse.kaya@university.edu.tr",
    },
    {
        "uid": "fatma.ozturk",
        "givenName": "Fatma",
        "sn": "Ozturk",
        "uidNumber": "1004",
        "mail": "fatma.ozturk@university.edu.tr",
    },
    {
        "uid": "ali.celik",
        "givenName": "Ali",
        "sn": "Celik",
        "uidNumber": "1005",
        "mail": "ali.celik@university.edu.tr",
    },
]

# ============================================
# HELPERS
# ============================================

passed = 0
failed = 0


def step(name: str):
    print(f"\n{'='*60}")
    print(f"  {name}")
    print(f"{'='*60}")


def ok(msg: str):
    global passed
    passed += 1
    print(f"  [PASS] {msg}")


def fail(msg: str):
    global failed
    failed += 1
    print(f"  [FAIL] {msg}")


def api_get(path: str):
    url = f"{BACKEND_URL}{path}"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode())


def api_post(path: str, body: dict | None = None):
    url = f"{BACKEND_URL}{path}"
    data = json.dumps(body).encode() if body else b""
    req = urllib.request.Request(
        url, data=data, method="POST",
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def api_delete(path: str):
    url = f"{BACKEND_URL}{path}"
    req = urllib.request.Request(url, method="DELETE")
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode())


def docker_exec(container: str, cmd: list[str], stdin_data: str | None = None) -> str:
    full_cmd = ["docker", "exec"]
    if stdin_data:
        full_cmd.append("-i")
    full_cmd.extend([container] + cmd)
    result = subprocess.run(
        full_cmd,
        input=stdin_data.encode() if stdin_data else None,
        capture_output=True,
        text=True,
        timeout=15,
    )
    return result.stdout + result.stderr


# ============================================
# STEP 0: PREFLIGHT CHECKS
# ============================================

def check_containers():
    step("Step 0: Preflight - Docker Containers")
    result = subprocess.run(
        ["docker", "ps", "--format", "{{.Names}} {{.Status}}"],
        capture_output=True, text=True, timeout=10,
    )
    running = result.stdout
    required = ["phishing-backend", "phishing-postgres", "phishing-ldap", "phishing-mailhog"]
    for name in required:
        if name in running:
            ok(f"{name} is running")
        else:
            fail(f"{name} is NOT running")

    # Backend health check
    try:
        req = urllib.request.Request(f"{BACKEND_URL}/health")
        with urllib.request.urlopen(req, timeout=5):
            ok("Backend /health responds OK")
    except Exception as e:
        fail(f"Backend /health failed: {e}")


# ============================================
# STEP 1: LDAP SETUP
# ============================================

def setup_ldap():
    step("Step 1: LDAP - Add Sample Users")

    # Check if ou=users already exists
    search_output = docker_exec(LDAP_CONTAINER, [
        "ldapsearch", "-x", "-H", "ldap://localhost",
        "-b", LDAP_BASE_DN,
        "-D", LDAP_ADMIN_DN, "-w", LDAP_ADMIN_PW,
        "-s", "one", "(objectClass=organizationalUnit)", "dn",
    ])

    # Create OUs if missing
    if "ou=users" not in search_output:
        ou_ldif = (
            f"dn: ou=users,{LDAP_BASE_DN}\n"
            "objectClass: organizationalUnit\n"
            "ou: users\n"
            "\n"
            f"dn: ou=groups,{LDAP_BASE_DN}\n"
            "objectClass: organizationalUnit\n"
            "ou: groups\n"
        )
        docker_exec(LDAP_CONTAINER, [
            "ldapadd", "-x", "-H", "ldap://localhost",
            "-D", LDAP_ADMIN_DN, "-w", LDAP_ADMIN_PW,
        ], stdin_data=ou_ldif)
        ok("Created ou=users and ou=groups")
    else:
        ok("OUs already exist")

    # Check existing users
    user_search = docker_exec(LDAP_CONTAINER, [
        "ldapsearch", "-x", "-H", "ldap://localhost",
        "-b", f"ou=users,{LDAP_BASE_DN}",
        "-D", LDAP_ADMIN_DN, "-w", LDAP_ADMIN_PW,
        "(objectClass=inetOrgPerson)", "uid",
    ])

    existing_uids = set()
    for line in user_search.splitlines():
        if line.startswith("uid: "):
            existing_uids.add(line.split("uid: ", 1)[1].strip())

    # Add missing users
    users_added = 0
    for user in LDAP_USERS:
        if user["uid"] in existing_uids:
            ok(f"{user['uid']} already exists - skipping")
            continue

        user_ldif = (
            f"dn: uid={user['uid']},ou=users,{LDAP_BASE_DN}\n"
            "objectClass: inetOrgPerson\n"
            "objectClass: posixAccount\n"
            "objectClass: shadowAccount\n"
            f"uid: {user['uid']}\n"
            f"sn: {user['sn']}\n"
            f"givenName: {user['givenName']}\n"
            f"cn: {user['givenName']} {user['sn']}\n"
            f"displayName: {user['givenName']} {user['sn']}\n"
            f"uidNumber: {user['uidNumber']}\n"
            "gidNumber: 1001\n"
            "userPassword: password123\n"
            f"homeDirectory: /home/{user['uid']}\n"
            f"mail: {user['mail']}\n"
        )
        output = docker_exec(LDAP_CONTAINER, [
            "ldapadd", "-x", "-H", "ldap://localhost",
            "-D", LDAP_ADMIN_DN, "-w", LDAP_ADMIN_PW,
        ], stdin_data=user_ldif)

        if "adding new entry" in output:
            ok(f"Added {user['uid']}")
            users_added += 1
        else:
            fail(f"Failed to add {user['uid']}: {output.strip()}")

    # Verify final count
    verify = docker_exec(LDAP_CONTAINER, [
        "ldapsearch", "-x", "-H", "ldap://localhost",
        "-b", f"ou=users,{LDAP_BASE_DN}",
        "-D", LDAP_ADMIN_DN, "-w", LDAP_ADMIN_PW,
        "(objectClass=inetOrgPerson)", "dn",
    ])
    count = verify.count("dn: uid=")
    if count == len(LDAP_USERS):
        ok(f"LDAP verification: {count}/{len(LDAP_USERS)} users present")
    else:
        fail(f"LDAP verification: expected {len(LDAP_USERS)}, found {count}")


# ============================================
# STEP 2: CAMPAIGN CREATION
# ============================================

def create_campaign() -> str | None:
    step("Step 2: Create Campaign")

    # Check for existing draft campaign with same name
    campaigns = api_get("/campaigns")
    for c in campaigns:
        if c["name"] == CAMPAIGN_NAME and c["status"] == "draft":
            ok(f"Reusing existing draft campaign: {c['id']}")
            return c["id"]

    # Clean up any old 'Automated Lab Test' campaigns (active/completed)
    for c in campaigns:
        if c["name"] == CAMPAIGN_NAME:
            try:
                api_delete(f"/campaigns/{c['id']}")
                ok(f"Cleaned up old campaign ({c['status']}): {c['id']}")
            except Exception:
                pass  # ignore if delete fails

    # Create new campaign
    campaign = api_post("/campaigns", {
        "name": CAMPAIGN_NAME,
        "description": "End-to-end system test",
    })

    campaign_id = campaign.get("id")
    status = campaign.get("status")

    if campaign_id and status == "draft":
        ok(f"Campaign created: {campaign_id} (status={status})")
        return campaign_id
    else:
        fail(f"Campaign creation unexpected response: {campaign}")
        return None


# ============================================
# STEP 3: LDAP SYNC
# ============================================

def sync_ldap(campaign_id: str) -> bool:
    step("Step 3: LDAP Sync to Campaign")

    result = api_post(f"/ldap/sync/{campaign_id}")

    total_found = result.get("totalFound", 0)
    synced = result.get("synced", 0)
    skipped = result.get("skipped", 0)
    errors = result.get("errors", 0)

    if result.get("success"):
        ok(f"Sync successful: {synced} synced, {skipped} skipped, {errors} errors")
    else:
        fail(f"Sync failed: {result}")
        return False

    if total_found == len(LDAP_USERS):
        ok(f"All {total_found} LDAP users found")
    else:
        fail(f"Expected {len(LDAP_USERS)} users, found {total_found}")

    # Verify recipients via API
    recipients = api_get(f"/campaigns/{campaign_id}/recipients")
    pending_count = sum(1 for r in recipients if r["status"] == "pending")

    if len(recipients) >= len(LDAP_USERS):
        ok(f"{len(recipients)} recipients in campaign ({pending_count} pending)")
    else:
        fail(f"Expected {len(LDAP_USERS)} recipients, got {len(recipients)}")

    return True


# ============================================
# STEP 4: START CAMPAIGN
# ============================================

def start_campaign(campaign_id: str) -> bool:
    step("Step 4: Start Campaign (Email Dispatch)")

    result = api_post(f"/campaigns/{campaign_id}/start")
    status = result.get("status")

    if status == "active":
        ok(f"Campaign status changed to: {status}")
    else:
        fail(f"Expected status 'active', got: {status}")
        return False

    return True


# ============================================
# STEP 5: VALIDATE RECIPIENTS
# ============================================

def validate_recipients(campaign_id: str):
    step("Step 5: Validate Recipients (Database)")

    recipients = api_get(f"/campaigns/{campaign_id}/recipients")

    sent_count = 0
    for r in recipients:
        email = r["email"]
        status = r["status"]
        sent_at = r.get("sentAt")
        if status == "sent" and sent_at:
            ok(f"{email} -> status={status}, sentAt={sent_at}")
            sent_count += 1
        else:
            fail(f"{email} -> status={status}, sentAt={sent_at}")

    if sent_count == len(LDAP_USERS):
        ok(f"All {sent_count}/{len(LDAP_USERS)} recipients marked as 'sent'")
    else:
        fail(f"Only {sent_count}/{len(LDAP_USERS)} recipients marked as 'sent'")


# ============================================
# STEP 6: VALIDATE MAILHOG
# ============================================

def validate_mailhog():
    step("Step 6: Validate MailHog (Email Delivery)")

    try:
        req = urllib.request.Request(f"{MAILHOG_URL}/api/v2/messages")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
    except Exception as e:
        fail(f"Could not reach MailHog API: {e}")
        return

    total = data.get("total", 0)
    items = data.get("items", [])

    # Find emails sent to our test users
    test_emails = {u["mail"] for u in LDAP_USERS}
    matched = set()
    for item in items:
        for to in item.get("To", []):
            addr = f"{to['Mailbox']}@{to['Domain']}"
            if addr in test_emails:
                matched.add(addr)

    if len(matched) == len(LDAP_USERS):
        ok(f"MailHog: all {len(matched)} test emails captured (total inbox: {total})")
    else:
        missing = test_emails - matched
        fail(f"MailHog: {len(matched)}/{len(LDAP_USERS)} found. Missing: {missing}")

    # Check sender and subject
    if items:
        sample = items[0]
        from_header = sample.get("Content", {}).get("Headers", {}).get("From", [""])[0]
        subject = sample.get("Content", {}).get("Headers", {}).get("Subject", [""])[0]
        ok(f"From: {from_header}")
        ok(f"Subject: {subject}")


# ============================================
# STEP 7: DATABASE DIRECT CHECK
# ============================================

def validate_database(campaign_id: str):
    step("Step 7: Validate PostgreSQL (Direct Query)")

    output = subprocess.run(
        [
            "docker", "exec", "phishing-postgres",
            "psql", "-U", "phishing", "-d", "phishing_db", "-t", "-A", "-c",
            f"SELECT email, status, sent_at FROM recipients WHERE campaign_id = '{campaign_id}' ORDER BY email;",
        ],
        capture_output=True, text=True, timeout=10,
    )

    rows = [line for line in output.stdout.strip().splitlines() if line.strip()]
    sent_in_db = 0

    for row in rows:
        parts = row.split("|")
        if len(parts) >= 3:
            email, status, sent_at = parts[0], parts[1], parts[2]
            if status == "sent" and sent_at:
                sent_in_db += 1
                ok(f"DB: {email} -> {status} @ {sent_at}")
            else:
                fail(f"DB: {email} -> {status} (sent_at={sent_at})")

    if sent_in_db == len(LDAP_USERS):
        ok(f"Database: all {sent_in_db}/{len(LDAP_USERS)} rows confirmed 'sent'")
    else:
        fail(f"Database: {sent_in_db}/{len(LDAP_USERS)} rows 'sent'")


# ============================================
# MAIN
# ============================================

def main():
    print("\n" + "=" * 60)
    print("  PHISHING SIMULATION - END-TO-END SYSTEM TEST")
    print("=" * 60)

    check_containers()

    if failed > 0:
        print("\n[ABORT] Preflight checks failed. Fix Docker containers first.")
        sys.exit(1)

    setup_ldap()

    campaign_id = create_campaign()
    if not campaign_id:
        print("\n[ABORT] Could not create campaign.")
        sys.exit(1)

    if not sync_ldap(campaign_id):
        print("\n[ABORT] LDAP sync failed.")
        sys.exit(1)

    if not start_campaign(campaign_id):
        print("\n[ABORT] Campaign start failed.")
        sys.exit(1)

    validate_recipients(campaign_id)
    validate_mailhog()
    validate_database(campaign_id)

    # Final summary
    print(f"\n{'='*60}")
    print(f"  RESULTS: {passed} passed, {failed} failed")
    print(f"{'='*60}")

    if failed == 0:
        print("  All tests PASSED!")
    else:
        print("  Some tests FAILED.")

    print()
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
