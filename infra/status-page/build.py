"""Packs probe.mjs into probe.zip for Lambda, reproducibly (fixed timestamps), so the zip only
changes when the code does. Run after editing probe.mjs; CI checks the two match."""

import zipfile
from pathlib import Path

HERE = Path(__file__).parent
info = zipfile.ZipInfo("probe.mjs", date_time=(2020, 1, 1, 0, 0, 0))
info.compress_type = zipfile.ZIP_DEFLATED
info.external_attr = 0o644 << 16
with zipfile.ZipFile(HERE / "probe.zip", "w") as archive:
    archive.writestr(info, (HERE / "probe.mjs").read_bytes())
print("wrote", HERE / "probe.zip")
