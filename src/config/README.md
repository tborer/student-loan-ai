# Configuration Data

This directory contains config-driven data for the analysis engine and provider directory. These tables are refreshable and should be updated as regulatory rules change or lender rates update.

## Regulatory Tables (regulatory.json)

- Federal repayment plan statuses and effective dates
- RAP payment percentage brackets by AGI
- IDR plan minimum payments and forgiveness terms
- Federal poverty guidelines by household size/state
- Consolidation deadline tracking (historical: June 30, 2026 per spec)
- PSLF employer qualification rules (including Jul 1, 2026 substantial illegal purpose rule)

## Provider Directory (providers.json)

- Lender options for refinance by credit tier
- Government portal URLs (studentaid.gov links)
- Affiliate flags and FTC-compliant disclosure requirements
- State and credit-tier restrictions per lender

## Usage

These configs are loaded at runtime into the analysis engine. The TypeScript config system validates structure, but values are runtime-stored for updates without redeploying.

See `src/config/` for current placeholder structures. Implement serverless function to fetch/update these from a managed source (e.g., JSON stored in S3 + API Gateway, or similar).