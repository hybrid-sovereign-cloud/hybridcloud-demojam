# Shared Hybrid Sovereign Ansible Operator base image
# Runtime Deployments differ by mounted watches.yaml + OPERATOR_KIND env.
FROM quay.io/operator-framework/ansible-operator:v1.42.2

COPY requirements.yml ${HOME}/requirements.yml
RUN ansible-galaxy collection install -r ${HOME}/requirements.yml \
 && chmod -R ug+rwx ${HOME}/.ansible

COPY watches/ ${HOME}/watches/
COPY roles/ ${HOME}/roles/
COPY playbooks/ ${HOME}/playbooks/

# Default watches replaced at runtime via ConfigMap mount when OPERATOR_KIND set
COPY watches/watches-entity.yaml ${HOME}/watches.yaml

ENV ANSIBLE_GATHERING=explicit \
    OPERATOR_KIND=entity
