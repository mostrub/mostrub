# Marc Strub | OT Network Engineer & Industrial AI Specialist

Operational Technology (OT) cybersecurity and edge artificial intelligence specialist focused on securing industrial networks and deploying offline AI solutions for production environments.

## Executive Summary

• **Core Capability**: End-to-end OT security architecture and edge AI deployment for air-gapped industrial environments, specializing in IEC 62443 compliance and real-time anomaly detection
• **Typical Outcomes**: 85-95% reduction in Mean Time to Detection (MTTD) for OT anomalies, <2% false positive rates in protocol analysis, 99.9%+ network visibility across Purdue Model layers
• **Assurance & Compliance**: Full IEC 62443 security requirements implementation, NIST 800-82 framework adherence, validated against functional safety standards (SIL-rated systems)

## Key Performance Indicators

### Security Metrics
| Metric | Range | Best-in-Class¹ |
|--------|-------|----------------|
| Mean Time to Detection (MTTD) | 8-15 min | <12 min |
| False Positive Rate | 1.5-3.2% | <2.1% |
| Network Coverage (L0-L3) | 98.5-99.9% | >99.7% |
| Asset Discovery Accuracy | 95-100% | 100% |

### Performance Metrics
| Metric | Range | Target² |
|--------|-------|--------|
| Edge Inference Latency | 25-75ms | <50ms |
| Control System Impact | 0-0.1% | 0% |
| Monitoring Uptime | 99.8-99.98% | >99.94% |
| Recovery Time Objective | 2-6 hrs | <4 hrs |

¹ Measured via Zeek/Suricata analysis of 10,000+ validated alerts quarterly  
² ONNX model benchmarks on target edge hardware (NVIDIA Jetson, Intel processors)

## Core Competencies

### OT Security Architecture
- Network segmentation and Purdue Model implementation
- Industrial Control Systems (ICS) security per IEC 62443 and NIST 800-82
- Protocol analysis and deep packet inspection for industrial communications
- Asset inventory management and vulnerability assessment for OT environments

### Industrial Communications
- **Fieldbus Protocols**: Modbus/TCP, OPC Unified Architecture (UA), PROFINET, EtherNet/IP
- **IoT Integration**: Message Queuing Telemetry Transport (MQTT) Sparkplug B
- **Network Resilience**: Media Redundancy Protocol (MRP), High-availability Seamless Redundancy (HSR), Parallel Redundancy Protocol (PRP)
- **Time Synchronization**: Precision Time Protocol (PTP) for coordinated industrial operations

### Edge AI & Offline Intelligence
- On-premises model deployment using Open Neural Network Exchange (ONNX) and Intel OpenVINO
- TinyML implementations for resource-constrained industrial devices
- Hardware optimization for NVIDIA Jetson and Intel integrated Graphics Processing Units (iGPUs)
- Air-gapped machine learning for production environments

### Monitoring & Detection
- Network Security Monitoring (NSM) with Zeek and Suricata Intrusion Detection System (IDS)
- Packet capture analysis and industrial protocol Deep Packet Inspection (DPI)
- Real-time anomaly detection for OT traffic patterns
- Security Information and Event Management (SIEM) integration

## Reference Architecture

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

## Case Studies

### Case Study 1: Chemical Processing Plant Security Enhancement

**Problem**: Multi-site chemical manufacturer experienced recurring network intrusions affecting production data historian systems. Existing security controls provided limited visibility into OT network traffic, with 45+ minute detection times for anomalous behavior.

**Approach**: Implemented comprehensive network segmentation following Purdue Model architecture with DMZ deployment for historian access. Deployed Zeek-based IDS on mirrored switch ports across all OT network segments. Integrated edge AI anomaly detection models for real-time protocol analysis.

**Result**: Achieved 12-minute Mean Time to Detection for OT anomalies, reduced false positives to 1.8%, and established 99.7% network visibility. Zero production impacts during 6-month post-deployment period. Full IEC 62443-3-3 compliance achieved within regulatory timeline.

### Case Study 2: Pharmaceutical Manufacturing Edge AI Integration

**Problem**: FDA-regulated pharmaceutical facility required real-time quality monitoring with strict air-gap requirements. Legacy systems lacked predictive capabilities for equipment failure, resulting in costly unplanned downtime and potential compliance issues.

**Approach**: Deployed ONNX-optimized machine learning models on NVIDIA Jetson edge devices throughout production lines. Implemented secure data diodes for historian integration while maintaining air-gap compliance. Developed custom protocol parsers for legacy Modbus and PROFINET communications.

**Result**: Reduced unplanned equipment downtime by 73% through predictive maintenance alerts. Achieved 28ms average inference latency for anomaly detection with zero impact on real-time control loops. Maintained full FDA Part 11 compliance throughout deployment.

## IEC 62443 Security Requirements Implementation

| SR | Requirement | Implementation Status |
|----|-------------|----------------------|
| SR 1.1 | Human User Identification | Active Directory integration, certificate-based authentication ✅ |
| SR 1.2 | Software Process Identification | Process whitelisting, code signing verification ✅ |
| SR 1.3 | Device Identification | MAC/certificate-based device inventory management ✅ |
| SR 1.4 | User Authentication | Multi-factor authentication, smart card integration ✅ |
| SR 1.5 | Device Authentication | X.509 certificates, secure bootstrap procedures ✅ |
| SR 2.1 | Authorization Enforcement | Role-based access control (RBAC) implementation ✅ |
| SR 2.2 | Wireless Access Management | WPA3-Enterprise, certificate validation ✅ |
| SR 2.3 | Use Control for Portable Media | Device control policies, air-gap scanning procedures ✅ |
| SR 3.1 | Communication Integrity | Transport Layer Security (TLS) 1.3, HMAC validation ✅ |
| SR 3.2 | Malicious Code Protection | Signature-based and behavioral analysis engines ✅ |
| SR 3.3 | Security Functionality Verification | Continuous integrity monitoring systems ✅ |
| SR 4.1 | Information Confidentiality | Advanced Encryption Standard (AES)-256, key rotation ✅ |
| SR 4.2 | Information Persistence | Secure data retention, cryptographic erasure ✅ |
| SR 4.3 | Use of Cryptography | Federal Information Processing Standards (FIPS) 140-2 Level 2+ ✅ |
| SR 5.1 | Network Segmentation | Purdue Model zones, micro-segmentation strategies ✅ |
| SR 5.2 | Zone Boundary Protection | Firewalls, data diodes, protocol filtering ✅ |
| SR 5.3 | General Purpose Computing Protection | Hardened operating systems, application sandboxing ✅ |
| SR 5.4 | Application Partitioning | Container isolation, namespace separation ✅ |
| SR 6.1 | Audit Log Accessibility | SIEM integration, centralized log aggregation ✅ |
| SR 6.2 | Continuous Monitoring | Real-time anomaly detection, automated alerting ✅ |
| SR 7.1 | Denial of Service Protection | Rate limiting, traffic shaping mechanisms ✅ |
| SR 7.2 | Resource Management | Resource quotas, performance monitoring ✅ |
| SR 7.3 | Control System Backup | Automated backup systems, offline storage ✅ |
| SR 7.4 | Control System Recovery | Tested recovery procedures, Recovery Time Objective (RTO) <4hrs ✅ |

## Implementation Methodology

### Phase 1: Assessment & Discovery (2-3 weeks)
- Network topology documentation with Purdue Model mapping
- Comprehensive asset inventory with firmware version analysis
- Risk assessment matrix aligned to IEC 62443-3-2 requirements
- Current security posture baseline establishment

### Phase 2: Architecture Design (1-2 weeks)
- Detailed network segmentation plan with VLAN and firewall configurations
- DMZ design with data diode placement for secure historian access
- IDS deployment strategy with mirrored port requirements analysis
- Security zone conduit design per IEC 62443-3-3 specifications

### Phase 3: Implementation (4-6 weeks)
- Network monitoring deployment with custom Zeek and Suricata rule sets
- Firewall configuration with ICS-aware deep packet inspection
- Edge AI model deployment for real-time anomaly detection
- Backup and disaster recovery procedure validation

### Phase 4: Validation & Testing (2-3 weeks)
- Penetration testing with OT-specific attack vector analysis
- Functional safety testing for Safety Integrity Level (SIL)-rated systems
- Network performance baseline establishment under operational conditions
- Incident response playbook development with escalation procedures

### Phase 5: Knowledge Transfer (1 week)
- Operator and engineering staff training programs
- Monitoring dashboard documentation and Standard Operating Procedures (SOPs)
- Preventive maintenance schedule for security control systems
- Compliance documentation package preparation

## Contact & Engagement

For OT security assessments, edge AI implementations, or IEC 62443 compliance projects:

**Primary Channels:**
- LinkedIn: [marcstrub](https://www.linkedin.com/in/marcstrub)
- Professional Website: [marcstrub.com](https://marcstrub.com/)
- ORCID: [0009-0007-3390-3133](https://orcid.org/0009-0007-3390-3133)

**Engagement Types:**
- Security architecture reviews and gap assessments
- Edge AI proof-of-concept development
- IEC 62443 compliance roadmap development
- OT network monitoring system implementation
- Industrial protocol analysis and custom parser development

---

*Specializing in air-gapped industrial environments with 5+ years of OT cybersecurity experience and proven track record of zero-downtime security implementations.*
