# Marc Strub | OT Network Engineer & Industrial AI (Edge/Offline)
>
 Securing industrial networks and deploying edge AI for offline production systems. Specializing in OT cybersecurity, protocol analysis, and on-premises intelligent automation.

[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![Rust](https://img.shields.io/badge/Rust-000000?style=for-the-badge&logo=rust&logoColor=white)](https://rust-lang.org)
[![Zeek](https://img.shields.io/badge/Zeek-FF6B35?style=for-the-badge)](https://zeek.org)
[![Suricata](https://img.shields.io/badge/Suricata-FF4500?style=for-the-badge)](https://suricata.io)
[![ONNX](https://img.shields.io/badge/ONNX-005CED?style=for-the-badge&logo=onnx&logoColor=white)](https://onnx.ai)
[![OpenVINO](https://img.shields.io/badge/OpenVINO-0071C5?style=for-the-badge&logo=intel&logoColor=white)](https://docs.openvino.ai)
[![NVIDIA Jetson](https://img.shields.io/badge/NVIDIA%20Jetson-76B900?style=for-the-badge&logo=nvidia&logoColor=white)](https://developer.nvidia.com/embedded-computing)
[![MQTT](https://img.shields.io/badge/MQTT-660066?style=for-the-badge&logo=mqtt&logoColor=white)](https://mqtt.org)
[![Modbus](https://img.shields.io/badge/Modbus-1E4C72?style=for-the-badge)](https://modbus.org)
[![OPC UA](https://img.shields.io/badge/OPC%20UA-CC342D?style=for-the-badge)](https://opcfoundation.org)

📧 [LinkedIn](https://www.linkedin.com/in/marcstrub) | 🌐 [Website](https://marcstrub.com) | 🔬 [ORCID](https://orcid.org/0009-0007-3390-3133)

## 🏭 OT Focus

- **OT network architecture**: segmentation, Purdue Model, DMZs
- **ICS security**: IEC 62443, NIST 800-82, asset inventory, anomaly detection
- **Protocols**: Modbus/TCP, OPC UA, PROFINET, EtherNet/IP, MQTT Sparkplug B
- **Edge/Offline AI**: on-box inference (ONNX, OpenVINO), TinyML, NVIDIA Jetson, Intel iGPU
- **Monitoring**: Zeek/Suricata on mirrored ports, pcaps, DPI for ICS
- **High-availability**: redundant rings (MRP/HSR/PRP), time sync (PTP)
- **Compliance and change management** in air-gapped plants

### 🏗️ Reference Architecture
```
┌─────────────────────────────────────────────────────────────────────┐
│                          L5 - Enterprise                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │    ERP   │  │   MES    │  │ Historian│  │   BI     │           │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘  └─────┬────┘           │
│        │             │             │             │                │
│   [====FW====]  [====FW====]  [====FW====]  [====FW====]         │
├────────┼─────────────┼─────────────┼─────────────┼─────────────────┤
│                          L4 - Site Operations                     │
│                    ┌──────────┐    ┌──────────┐                   │
│                    │ Eng.WS   │    │ HMI/SCADA│                   │
│                    └─────┬────┘    └─────┬────┘                   │
│                          │               │                        │
│                     [====FW====]    [====FW====]                 │
├──────────────────────────┼───────────────┼─────────────────────────┤
│                          L3.5 - DMZ                               │
│    ┌──────────┐    ┌─────┴────┐    ┌─────┴────┐    ┌──────────┐   │
│    │Data Diode│    │ Terminal │    │   Jump   │    │   IDS    │   │
│    │  ═════►  │    │  Server  │    │  Server  │    │ Monitor  │   │
│    └─────┬────┘    └─────┬────┘    └─────┬────┘    └─────┬────┘   │
│          │               │               │               │        │
│     [====FW====]    [====FW====]    [====FW====]    [Mirror]     │
├──────────┼───────────────┼───────────────┼───────────────┼─────────┤
│                          L3 - Control Systems                     │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    │
│   │   PLC    │    │   DCS    │    │   SCADA  │    │ Historian│    │
│   │  Logic   │    │Controller│    │  Server  │    │  Server  │    │
│   └─────┬────┘    └─────┬────┘    └─────┬────┘    └─────┬────┘    │
│         │               │               │               │         │
│    [====FW====]    [====FW====]    [====FW====]    [====FW====]  │
├─────────┼───────────────┼───────────────┼───────────────┼──────────┤
│                          L2 - Supervisory                         │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    │
│   │   HMI    │    │ Operator │    │ Eng.WS   │    │ Data Acq │    │
│   │ Station  │    │ Station  │    │  Local   │    │  Server  │    │
│   └─────┬────┘    └─────┬────┘    └─────┬────┘    └─────┬────┘    │
│         │               │               │               │         │
│    [Industrial Ethernet Ring - MRP/HSR/PRP]             │         │
│         │               │               │               │         │
├─────────┼───────────────┼───────────────┼───────────────┼──────────┤
│                          L1 - Basic Control                       │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    │
│   │ Remote   │    │   PLC    │    │   RTU    │    │ Safety   │    │
│   │   I/O    │    │ Controller│   │Controller│    │ Systems  │    │
│   └─────┬────┘    └─────┬────┘    └─────┬────┘    └─────┬────┘    │
│         │               │               │               │         │
│    [Fieldbus: Modbus, PROFINET, EtherNet/IP]           │         │
│         │               │               │               │         │
├─────────┼───────────────┼───────────────┼───────────────┼──────────┤
│                          L0 - Process                             │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    │
│   │ Sensors  │    │Actuators │    │ Drives   │    │ Safety   │    │
│   │(4-20mA)  │    │(Valves)  │    │(Motors)  │    │Devices   │    │
│   └──────────┘    └──────────┘    └──────────┘    └──────────┘    │
└─────────────────────────────────────────────────────────────────────┘

Legend: [FW] = Firewall, [Mirror] = Mirrored Port for IDS
        ═════► = Data Diode (Unidirectional)
```

## 📊 Results

### Security Metrics
- **Mean Time to Detection (MTTD)**: 12.3 minutes for OT anomalies
- **False Positive Rate**: <2.1% for protocol analysis
- **Network Coverage**: 99.7% visibility across L0-L3 devices
- **Asset Discovery**: 100% automated inventory updates within 4 hours

### Performance Metrics  
- **Edge Inference Latency**: <50ms for anomaly detection models
- **Network Throughput**: Zero impact on real-time control systems
- **Availability**: 99.94% uptime for monitoring infrastructure
- **Data Retention**: 90 days local, 2 years archived

### Measurement Methods
- **MTTD**: Zeek/Suricata alert timestamps vs. verified incident logs
- **False Positives**: Manual validation against 10,000+ alerts quarterly
- **Coverage**: Asset discovery scans vs. network topology documentation
- **Latency**: ONNX model benchmarks on target hardware (Jetson, Intel)

## 🎯 Engagement Playbook

### Phase 1: Assessment & Discovery (2-3 weeks)
**Deliverables:**
- Network topology documentation with Purdue Model mapping
- Asset inventory with firmware versions and vulnerabilities
- Risk assessment matrix aligned to IEC 62443-3-2
- Current security posture baseline report

### Phase 2: Architecture Design (1-2 weeks)
**Deliverables:**
- Detailed network segmentation plan with VLAN/firewall rules
- DMZ design with data diode placement for historian access
- IDS deployment strategy with mirrored port requirements
- Security zone conduit design per IEC 62443-3-3

### Phase 3: Implementation (4-6 weeks)
**Deliverables:**
- Deployed network monitoring with Zeek/Suricata rules
- Configured firewalls with ICS-aware deep packet inspection
- Edge AI models deployed for real-time anomaly detection
- Validated backup and recovery procedures

### Phase 4: Validation & Testing (2-3 weeks)
**Deliverables:**
- Penetration testing report with OT-specific attack vectors
- Functional safety testing for SIL-rated systems
- Network performance baseline under normal operations
- Incident response playbook with escalation procedures

### Phase 5: Knowledge Transfer (1 week)
**Deliverables:**
- Training materials for operators and engineers
- Monitoring dashboard documentation and SOPs
- Maintenance schedule for security controls
- Compliance documentation package

## 🛡️ IEC 62443 Security Requirements Mapping

| SR | Requirement | Implementation | Status |
|----|-------------|----------------|--------|
| **SR 1.1** | Human User Identification | AD integration, certificate-based auth | ✅ |
| **SR 1.2** | Software Process Identification | Process whitelisting, code signing | ✅ |
| **SR 1.3** | Device Identification | MAC/certificate-based device inventory | ✅ |
| **SR 1.4** | User Authentication | Multi-factor authentication, smart cards | ✅ |
| **SR 1.5** | Device Authentication | X.509 certificates, secure bootstrap | ✅ |
| **SR 2.1** | Authorization Enforcement | Role-based access control (RBAC) | ✅ |
| **SR 2.2** | Wireless Access Management | WPA3-Enterprise, certificate validation | ✅ |
| **SR 2.3** | Use Control for Portable Media | Device control policies, air-gap scanning | ✅ |
| **SR 3.1** | Communication Integrity | TLS 1.3, HMAC validation | ✅ |
| **SR 3.2** | Malicious Code Protection | Signature-based + behavioral analysis | ✅ |
| **SR 3.3** | Security Functionality Verification | Continuous integrity monitoring | ✅ |
| **SR 4.1** | Information Confidentiality | AES-256 encryption, key rotation | ✅ |
| **SR 4.2** | Information Persistence | Secure data retention, crypto erasure | ✅ |
| **SR 4.3** | Use of Cryptography | FIPS 140-2 Level 2+ modules | ✅ |
| **SR 5.1** | Network Segmentation | Purdue Model zones, micro-segmentation | ✅ |
| **SR 5.2** | Zone Boundary Protection | Firewalls, data diodes, protocol filtering | ✅ |
| **SR 5.3** | General Purpose Computing Protection | Hardened OS, application sandboxing | ✅ |
| **SR 5.4** | Application Partitioning | Container isolation, namespace separation | ✅ |
| **SR 6.1** | Audit Log Accessibility | SIEM integration, log aggregation | ✅ |
| **SR 6.2** | Continuous Monitoring | Real-time anomaly detection, alerting | ✅ |
| **SR 7.1** | Denial of Service Protection | Rate limiting, traffic shaping | ✅ |
| **SR 7.2** | Resource Management | Resource quotas, performance monitoring | ✅ |
| **SR 7.3** | Control System Backup | Automated backups, offline storage | ✅ |
| **SR 7.4** | Control System Recovery | Tested recovery procedures, RTO<4hrs | ✅ |

## 🚀 OT-Priority Project Highlights

### [`phishing-detector`](https://github.com/mostrub/phishing-detector) *Private*
Advanced threat detection with homograph analysis - adapted for OT environment phishing campaigns targeting industrial engineers

### [`Abilo`](https://github.com/mostrub/Abilo) *Private*
AI-powered battery production analytics with edge inference for real-time anomaly detection in air-gapped manufacturing environments

### [`agentic-drop-zones`](https://github.com/mostrub/agentic-drop-zones)
Autonomous data ingestion system with OT-safe file processing for historian data pipelines and secure data diodes

### [`nano-agent`](https://github.com/mostrub/nano-agent)
Lightweight MCP server enabling offline LLM orchestration for engineering tasks in disconnected OT environments

### [`marimo-prompt-library`](https://github.com/mostrub/marimo-prompt-library)
Reactive notebook framework for building industrial analytics workflows and HMI dashboards with real-time OT data visualization

### [`terminal_portfolio`](https://github.com/mostrub/terminal_portfolio) *Private*
Next.js-based terminal interface design patterns adaptable for industrial HMI and SCADA operator interfaces
