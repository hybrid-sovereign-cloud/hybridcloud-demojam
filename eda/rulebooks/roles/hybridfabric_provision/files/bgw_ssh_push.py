#!/usr/bin/env python3
# Run a script as root on the border gateway over SSH: `sudo bash -s` with the
# script on stdin (bgw_config_push.yml). Uses the OpenSSH client when the
# execution environment has one, else paramiko (installed best-effort into the
# job venv, like openstack_fr6_probe.yml does for the OpenStack CLI).
#
# Usage: bgw_ssh_push.py HOST USER KEY_FILE SCRIPT_FILE TIMEOUT
# Prints the remote stdout; exits with the remote exit status, 255 when the
# connection itself failed (message on stderr).
import shutil
import subprocess
import sys


def via_openssh(host, user, key, script, timeout):
    with open(script, "rb") as f:
        p = subprocess.run(
            ["ssh", "-i", key, "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=no",
             "-o", "UserKnownHostsFile=/dev/null", "-o", "ConnectTimeout=15", "-o", "LogLevel=ERROR",
             "%s@%s" % (user, host), "sudo bash -s"],
            stdin=f, capture_output=True, timeout=timeout)
    sys.stdout.write(p.stdout.decode(errors="replace"))
    sys.stderr.write(p.stderr.decode(errors="replace"))
    return p.returncode


def via_paramiko(host, user, key, script, timeout):
    try:
        import paramiko
    except ImportError:
        subprocess.run([sys.executable, "-m", "pip", "install", "--quiet", "paramiko"],
                       capture_output=True, timeout=300)
        try:
            import paramiko
        except ImportError:
            print("no ssh client and paramiko unavailable in this execution environment", file=sys.stderr)
            return 255
    pkey = None
    for cls in ("Ed25519Key", "ECDSAKey", "RSAKey"):
        try:
            pkey = getattr(paramiko, cls).from_private_key_file(key)
            break
        except Exception:
            continue
    if pkey is None:
        print("unsupported private key format", file=sys.stderr)
        return 255
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(host, username=user, pkey=pkey, timeout=15, banner_timeout=15,
                       auth_timeout=15, look_for_keys=False, allow_agent=False)
        stdin, stdout, stderr = client.exec_command("sudo bash -s", timeout=timeout)
        with open(script, "rb") as f:
            stdin.write(f.read())
        stdin.channel.shutdown_write()
        out = stdout.read().decode(errors="replace")
        err = stderr.read().decode(errors="replace")
        rc = stdout.channel.recv_exit_status()
    except Exception as e:
        print("ssh to %s failed: %s: %s" % (host, type(e).__name__, e), file=sys.stderr)
        return 255
    finally:
        client.close()
    sys.stdout.write(out)
    sys.stderr.write(err)
    return rc


def main():
    host, user, key, script, timeout = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], int(sys.argv[5])
    try:
        if shutil.which("ssh"):
            return via_openssh(host, user, key, script, timeout)
        return via_paramiko(host, user, key, script, timeout)
    except subprocess.TimeoutExpired:
        print("ssh to %s timed out after %ss" % (host, timeout), file=sys.stderr)
        return 255


if __name__ == "__main__":
    sys.exit(main())
