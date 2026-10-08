# Lab 5 — UI path (optional)

Repeat Labs 2–4 using the console instead of YAML.

## Steps

1. Open **Admin** or **Tenant** console (SSO).
2. Admin: **Cloud Infrastructure** → check (or create) the site; the form shows only the section for the chosen type. Admin credentials are entered here, once per site.
3. Tenant: go to **Cloud AWS** / **Cloud OSO** / **Cloud Virt** → **Create**, pick the site in the Cloud Infrastructure dropdown. No admin credentials on tenant forms. Wait until detail shows Ready.
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
  → Delete CloudInfrastructure only if you created one (platform admin); delete its Secret; rotate keys
```
