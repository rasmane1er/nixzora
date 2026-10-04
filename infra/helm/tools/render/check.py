"""Renders the chart offline and checks every manifest against the Kubernetes schemas.

    python3 infra/helm/tools/render/check.py [values-file …]

Needs Go (the renderer in this folder) and `pip install pyyaml kubernetes-validate`.
"""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import kubernetes_validate
import yaml

HERE = Path(__file__).parent
CHART = HERE.parent.parent / "nixzora"
K8S_VERSION = "1.31"


def merge(base, extra):
    for key, value in extra.items():
        if isinstance(value, dict) and isinstance(base.get(key), dict):
            merge(base[key], value)
        else:
            base[key] = value
    return base


def render(values_files):
    values = yaml.safe_load((CHART / "values.yaml").read_text())
    for name in values_files:
        merge(values, yaml.safe_load(Path(name).read_text()) or {})
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as handle:
        json.dump(values, handle)
    out = subprocess.run(
        ["go", "run", ".", "-chart", str(CHART), "-values", handle.name, "-namespace", "nixzora"],
        cwd=HERE, capture_output=True, text=True, env={**os.environ, "GOFLAGS": "-mod=mod", "GOTOOLCHAIN": "local"},
    )
    os.unlink(handle.name)
    if out.returncode:
        sys.exit(out.stderr)
    return out.stdout


def main():
    files = sys.argv[1:]
    text = render(files)
    docs = [doc for doc in yaml.safe_load_all(text) if doc]
    kinds = {}
    errors = 0
    for doc in docs:
        kind = doc["kind"]
        kinds[kind] = kinds.get(kind, 0) + 1
        if "." in doc["apiVersion"].split("/")[0] and not doc["apiVersion"].startswith(
            ("apps/", "batch/", "autoscaling/", "policy/", "networking.k8s.io/")
        ):
            continue  # CRDs (ExternalSecret): not in the core schemas
        try:
            kubernetes_validate.validate(doc, K8S_VERSION, strict=True)
        except kubernetes_validate.ValidationError as error:
            errors += 1
            print(f"✗ {kind}/{doc['metadata']['name']}: {error.message} at {list(error.path)}")
    print(f"{len(docs)} manifests:", ", ".join(f"{n} {k}" for k, n in sorted(kinds.items())))
    if errors:
        sys.exit(f"{errors} invalid")
    print("All valid against Kubernetes", K8S_VERSION)
    if os.environ.get("SHOW"):
        print(text)


if __name__ == "__main__":
    main()
