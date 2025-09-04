## Key Performance Indicators

**Security Metrics**
- **MTTD:** 8–15 min (**target:** ≤10 min) — time from packet capture to alert emission
- **False positive rate:** 1.5–3.2% (**target:** ≤2.0%) — analyst-validated
- **Network coverage (L0–L3):** 98.5–99.9% (**target:** ≥99.7%) — monitored vs total segments/assets
- **Asset discovery accuracy:** 95–100% (**target:** 100%) — reconciled against CMDB/inventory

**Performance Metrics**
- **Edge inference latency:** 25–75 ms (**target:** ≤40 ms) — ONNX INT8 on NVIDIA Jetson / Intel iGPU
- **Control system impact:** 0–0.1% (**target:** 0%) — passive mirror ingest only
- **Monitoring uptime:** 99.8–99.98% (**target:** ≥99.95%) — redundant sensors + watchdogs
- **Recovery Time Objective (RTO):** 2–6 hrs (**target:** ≤4 hrs) — golden images + tested runbooks

**Validation**
- Security metrics computed quarterly over ≥10k alerts via Zeek/Suricata logs with analyst labels
- Latency measured via ONNX Runtime / OpenVINO microbenchmarks on named edge SKUs (batch=1, INT8)

**Assumptions & Scope**
- OT networks, Purdue L0–L3, passive monitoring, no inline blocking
- Air-gapped export (diode) for telemetry; scope excludes L4–L5 IT flows
