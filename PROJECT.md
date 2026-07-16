# Project: Anonymous Transfer Flow Verification

## Architecture
- Core Service: `server/services/umbra.ts` (manages stealth keys, announcements, UTXO mixer state)
- Frontend: client components interacting with Umbra/mixer features.
- Database: tables storing announcements, commitments, UTXOs.
- Testing Framework: Playwright (E2E), Vitest (unit/integration).

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Exploration & Code Review | Investigate `server/services/umbra.ts` and related codebase, review security & logic. | None | DONE |
| 2 | M2: E2E Test Suite Design | Establish test infra, design Tier 1-4 tests, write `TEST_INFRA.md`. | M1 | DONE |
| 3 | M3: Implementation & Fixing | Write Tier 1-4 tests, fix any bugs/vulnerabilities, ensure all tests pass. | M2 | DONE |
| 4 | M4: Forensic Audit & Validation | Run Forensic Auditor & Challenger on the final code. | M3 | IN_PROGRESS |
| 5 | M5: Synthesis & Reporting | Generate `verification_report.md` and complete the task. | M4 | PLANNED |

## Interface Contracts
### Client ↔ Umbra Service
- Stealth address generation, announcement submissions, UTXO registration, and claiming.
