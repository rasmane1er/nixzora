# Runbook: Kubernetes (EKS Auto Mode) next to ECS

Design: [ADR-0021](../adr/0021-kubernetes-eks-helm.md). Off by default; ECS keeps serving until
DNS moves.

## 1. Create the cluster (about 15 minutes)

1. Cost check: about 73 USD a month for the control plane, plus nodes and the Auto Mode fee.
2. In `infra/terraform/environments/staging/staging.tfvars`: `kubernetes_enabled = true`.
3. Plan and apply from CloudShell:

   ```sh
   ~/nx/tofu plan -var-file=staging.tfvars -var image_tag=<deployed sha> -out=eks.plan
   ~/nx/tofu apply eks.plan
   ```

   The plan adds the cluster, its roles and KMS key, Pod Identity associations, security group
   rules and subnet tags, and lets the app roles trust EKS Pod Identity. ECS is not changed.

4. Connect and check: `$(~/nx/tofu output -json platform | jq -r .kubernetes.value.update_kubeconfig)`,
   then `kubectl get nodes` (Auto Mode starts nodes only once pods need them, so none yet is normal).

## 2. Prepare the cluster (once)

```sh
kubectl apply -f infra/helm/cluster/namespace.yaml -f infra/helm/cluster/ingress-class.yaml
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets -n external-secrets --create-namespace
kubectl apply -f infra/helm/cluster/cluster-secret-store.yaml
```

## 3. Install NIXZORA

1. Copy the values Terraform prints into `values-staging.yaml`:
   `~/nx/tofu output -json platform | jq .kubernetes.value.helm_values` (database and Redis hosts,
   bucket, secret names), plus the ACM certificate ARN and the image tag to run.
2. Install (runs the migration Job first):

   ```sh
   helm upgrade --install nixzora infra/helm/nixzora -n nixzora \
     -f infra/helm/nixzora/values-staging.yaml --set image.tag=<sha> --wait --timeout 10m
   ```

3. Check: `kubectl -n nixzora get pods,hpa,ingress`. The ingress shows the ALB's DNS name; test
   with `curl -H 'Host: api.staging.nixzora.com' https://<alb-dns>/api/v1/health -k`.

## 4. Move traffic, and back

- To EKS: point `staging`, `api.staging` and `ops.staging` (Route 53 aliases) at the new ALB,
  wait for traffic to drain from the old one, then set the ECS services' desired count to 0.
- Back to ECS: restore the desired counts, point the aliases back at the ECS load balancer.
- Remove EKS: `helm uninstall nixzora -n nixzora`, then `kubernetes_enabled = false`, plan, apply.

## Something is wrong

| Symptom                                    | First look                                                                                                  |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `helm upgrade` fails on the hook           | `kubectl -n nixzora logs job/nixzora-migrate`; the running release is unchanged.                            |
| Pods stuck in `CreateContainerConfigError` | The ExternalSecret has not synced: `kubectl -n nixzora get externalsecrets` (check the store's IAM access). |
| Pods `Pending` for minutes                 | Auto Mode is starting a node: `kubectl get nodeclaims`. Check the node role and subnet capacity.            |
| ALB not created                            | `kubectl -n nixzora describe ingress nixzora-public`; subnets need the `kubernetes.io/role/elb` tag.        |
| API cannot reach the database              | Security group rules `eks_data` (cluster security group → data security group, 5432/6379).                  |
