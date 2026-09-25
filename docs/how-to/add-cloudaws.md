# How to: add a new CloudAWS (new AWS account)

Goal: point the platform at a **new AWS account** so you can provision OpenShift there.

## Prerequisites

- Entity namespace exists (`entity-acme-corp` or yours).
- IAM user/role keys with rights to create Route53 zones under your **parent** domain and to run cluster install (Hive / installer needs).
- Parent hosted zone in Route53 (e.g. `sandboxNNNN.opentlc.com`).

## Steps

### 1. Create credential Secret (never commit)

```bash
oc create secret generic aws-acct-<label> -n entity-<entity> \
  --from-literal=AWS_ACCESS_KEY_ID='...' \
  --from-literal=AWS_SECRET_ACCESS_KEY='...' \
  --from-literal=ACCOUNT_ID='123456789012'
```

### 2. Create CloudAWS

```yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: CloudAWS
metadata:
  name: <label>          # e.g. prod-aws-42
  namespace: entity-<entity>
spec:
  account: "123456789012"
  baseDomain: sandboxNNNN.opentlc.com
  credentialsSecretRef:
    name: aws-acct-<label>
```

```bash
oc apply -f cloudaws-<label>.yaml
```

### 3. Wait until ready

```bash
oc get cloudaws <label> -n entity-<entity> -w
# expect status.ready=true and status.domain=<slug>.<baseDomain>
```

If failed: `oc describe cloudaws <label> -n entity-<entity>` and check AAP job logs for the CloudAWS JobTemplate.

### 4. Provision a cluster

```yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: PlatformOpenshift
metadata:
  name: ocp-<label>
  namespace: entity-<entity>
spec:
  type: aws
  aws:
    environment: <label>
    region: us-east-1
    clusterType: standalone
    controlPlaneCount: 3
    workerCount: 2
```

Wait for Provisioned / `status.ready`.

### 5. (Optional) Assignment

Create Team + Assignment pointing `openshift: ocp-<label>` — see [team-project-assignment](../usage/crds/team-project-assignment.md).

## Remove

1. Delete PlatformOpenshift(s) using this CloudAWS; wait for teardown.
2. Delete CloudAWS.
3. Delete Secret; rotate IAM keys; remove Vault path if used.

## See also

- [CloudAWS CRD](../usage/crds/cloudaws.md)
- [Workshop lab](../workshop/README.md)
