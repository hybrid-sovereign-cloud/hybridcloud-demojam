# How-to guides

Onboarding a real cloud, for keeps. For the guided version with explanation,
do [workshop Lab 6](../workshop/lab-06-register-cloud.md) first.

| Guide | Use when |
|-------|----------|
| [Add CloudOSO](add-cloudoso.md) | New RHOSO / OpenStack cloud (`clouds.yaml`) |
| [Add CloudAWS](add-cloudaws.md) | New AWS account + Route53 parent domain |
| [Add CloudVirt](add-cloudvirt.md) | New CNV / virt cluster for hosted OpenShift |

Each follows the same two-step split: a platform admin registers the
**CloudInfrastructure** (which holds the credential), then tenants create
**Cloud\*** project CRs against it with `spec.cloudRef`.

| Next | |
|------|---|
| Field reference | [reference/crds](../reference/crds/README.md) |
| Build a cluster on it | [workshop Lab 7](../workshop/lab-07-provision-platform.md) |
| Join it to the fabric | [workshop Lab 9](../workshop/lab-09-hybrid-fabric.md) |
