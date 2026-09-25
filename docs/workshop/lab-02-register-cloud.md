# Lab 2 — Register a cloud

Pick **one** track. Full detail: [add-cloudaws](../how-to/add-cloudaws.md) · [add-cloudoso](../how-to/add-cloudoso.md) · [add-cloudvirt](../how-to/add-cloudvirt.md).

Replace `entity-acme-corp` if your entity differs.

## Track A — CloudAWS

```bash
oc create secret generic workshop-aws-creds -n entity-acme-corp \
  --from-literal=AWS_ACCESS_KEY_ID='...' \
  --from-literal=AWS_SECRET_ACCESS_KEY='...' \
  --from-literal=ACCOUNT_ID='...'
```

```yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: CloudAWS
metadata:
  name: workshop-aws
  namespace: entity-acme-corp
spec:
  account: "YOUR_ACCOUNT_ID"
  baseDomain: YOUR_PARENT_DOMAIN   # e.g. sandbox1022.opentlc.com
  credentialsSecretRef:
    name: workshop-aws-creds
```

```bash
oc apply -f workshop-aws.yaml
oc get cloudaws workshop-aws -n entity-acme-corp -w
```

**Pass:** `status.ready=true` and `status.domain` set.

## Track B — CloudOSO

```bash
oc create secret generic workshop-oso-creds -n entity-acme-corp \
  --from-file=clouds.yaml=$HOME/Downloads/clouds.yaml
```

```yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: CloudOSO
metadata:
  name: workshop-oso
  namespace: entity-acme-corp
spec:
  project: workshop-oso
  baseDomain: YOUR_BASE_DOMAIN
  credentialsSecretRef:
    name: workshop-oso-creds
  externalNetwork: internet
```

```bash
oc apply -f workshop-oso.yaml
oc get cloudoso workshop-oso -n entity-acme-corp -w
```

**Pass:** `status.ready=true`.

## Track C — CloudVirt

Use existing `local-virt` **or** create a new CloudVirt per [add-cloudvirt](../how-to/add-cloudvirt.md).

```bash
oc get cloudvirt local-virt -n entity-acme-corp
# ready → use name local-virt in Lab 3 hosted track
```

→ [Lab 3](lab-03-provision-platform.md)
