# Hardening Check — AAP Split Placement

**Retested**: 2026-07-15

| Check | Expected | Result |
|-------|----------|--------|
| Central AAP Controller | Present | PASS — `automationcontroller/sovereign-aap-controller` |
| Central AAP EDA | Present | PASS — `eda/sovereign-aap-eda` |
| Services AAP Controller | Present | PASS — `sovereign-aap-controller` |
| Services EDA | Absent | PASS — values `aap.eda.enabled: false` |
| Hub | Disabled both | PASS — values |
| Config-as-code Job | Central gateway | PASS — `job-aap-config-as-code` Synced |
| License Jobs | Present | PASS — `job-aap-license-central`, `job-aap-license-services` |
| Job launch without license | Must fail closed | PASS — API returns `License is missing` when unset |

## Gaps

| ID | Gap | Severity |
|----|-----|----------|
| AAP-001 | Controller job execution blocked until license applied | HIGH (ops) |
| AAP-002 | SCM project sync on EE still fragile (credential decrypt / git safe.directory) | MED |
