# Lab 5 — UI path (optional)

Repeat Labs 2–4 using the console instead of YAML.

## Steps

1. Open **Admin** or **Tenant** console (SSO).
2. Tenant: go to **Cloud AWS** / **Cloud OSO** / **Cloud Virt** → **Create**.
3. Paste credentials in the form (creates Secret + CR). Wait until detail shows Ready.
4. **Platforms** → Create → pick type `aws` / `openstack` / `hosted` and the Cloud\* you just made.
5. **Teams** / **Assignments** → create Assignment to that platform.
6. Open platform detail → confirm console URL / status.

## Pass

Same outcomes as Labs 2–4 without hand-written YAML (except you understand the CRs still exist underneath).

Docs: [UI usage](../usage/ui/README.md).

## Cleanup checklist

```text
Delete Assignment(s)
  → Delete PlatformOpenshift (wait teardown)
  → Delete Cloud* (optional)
  → Delete Secret; rotate keys
```
