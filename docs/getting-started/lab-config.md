# Lab hardcoding / secrets policy
#
# Never commit:
# - Passwords, tokens, kubeconfigs, clouds.yaml
# - Lab IPs (e.g. private DNS forwarders)
# - Private lab domains (*.lab.<your-domain>)
#
# Store locally in `.env` (gitignored). Upload topology to Vault:
#   make -C bootstrap upload-lab-config
# Apps retrieve via ExternalSecret `lab-config` or Job env from that Secret.
#
# Generate Helm overlay (gitignored):
#   make -C bootstrap render-values-lab
#
# See `.env.example` and `bootstrap/helm/central/values-lab.yaml.example`.
