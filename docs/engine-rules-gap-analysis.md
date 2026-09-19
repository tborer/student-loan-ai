# Analysis Engine — Rules Gap Analysis

2026-09-19 · audit of `src/utils/analysis.ts` and `src/config/*.json`

## Verdict

The engine now classifies loans correctly and computes IBR, RAP, refinance and
consolidation figures that reconcile against hand-checked amortization. What it
does **not** yet do is model the consequences of those choices. As it stands it
can report a strategy as "saving" money that costs the borrower thousands more,
and can promise forgiveness without mentioning the tax bill attached to it.

Two findings below are marked **misleading** rather than merely incomplete.
Those should be closed before the tool charges anyone.

Every regulatory figure cited here came from secondary reporting, because
`congress.gov`, `aspe.hhs.gov` and `federalregister.gov` are unreachable from
the build environment. Anything marked **verify** needs checking against the
primary source before launch.

---

## 1. Misleading output (fix before charging)

### 1.1 Monthly relief is reported as "savings"

`estimatedAnnualSavings` is `(baseline − plan payment) × 12`. That is monthly
cash-flow relief, not savings. Worked example, the engine's own numbers for a
$30,000 Direct Subsidized loan at 6.5%, AGI $45,000, household of 1:

| | Monthly | Months to repay | Total paid |
| --- | --- | --- | --- |
| Standard 10-year | $340.64 | 120 | $40,877 |
| IBR | $263.25 | 178 | $46,858 |

The engine reports **"$929/yr saved."** The borrower actually pays **$5,981
more**. The figure is not wrong arithmetic — it is the wrong quantity.

**Rule needed.** Compute total cost over each strategy's own term and report
both: monthly change *and* lifetime cost delta. Where lifetime cost rises, say
so on the same card, not in a footnote. A strategy chosen for affordability is
legitimate; presenting it as cheaper is not.

### 1.2 Forgiveness is presented without its tax consequence

The temporary federal exclusion for discharged student debt **expired at the
end of 2025**. IDR forgiveness (IBR at 20/25 years, RAP at 30) is now treated
as taxable income. PSLF remains tax-free by statute.

A borrower forgiven $80,000 in year 25 could face a five-figure federal bill in
that single year, plus state tax depending on conformity. The engine currently
surfaces "Remaining balance forgiven after the plan term" with no mention of
this.

**Rule needed.** Split forgiveness into taxable (IDR) and tax-free (PSLF).
Estimate the projected forgiven balance and flag the tax event. State-level
conformity varies, so key it off `stateOfResidence` or state it as federal-only
and say so. **verify** — confirm the exclusion's expiry and any 2026 extension.

---

## 2. Rules the engine gets structurally wrong

### 2.1 IBR's rate depends on an input we never collect

IBR is not one plan:

| Cohort | Payment | Forgiveness |
| --- | --- | --- |
| First disbursement **before** July 1 2014 | 15% of discretionary income | 25 years |
| First disbursement **on/after** July 1 2014 | 10% of discretionary income | 20 years |

The engine hardcodes 15%/25. For a post-2014 borrower that **overstates the
monthly payment by 50%**, which understates relief and may rank IBR below
strategies that are genuinely worse for them.

**Rule needed.** Collect first disbursement date (or a "before/after July 2014"
question) per loan, and drive both the percentage and the forgiveness term from
it.

### 2.2 RAP's defining mechanics are unmodeled

The engine computes RAP's bracket payment and stops. RAP additionally:

- **waives unpaid interest** each month the payment does not cover accrual;
- **matches principal up to $50/month** when the borrower's own payment retires
  less than $50 of principal;
- **forgives at 360 qualifying payments (30 years)**;
- **withdraws both benefits for any month paid late or short**.

This matters arithmetically. In the worked example RAP's $150/month is below
the $162.50 monthly interest accrual — without the waiver the balance grows
forever. With the waiver plus the $50 match, it amortizes. The engine's payoff
maths would be wrong in either direction without modelling this.

**Rule needed.** Model the waiver and the match in any RAP projection, carry the
30-year term, and state the on-time condition as a trade-off.

### 2.3 Filing status is collected but cannot affect anything

`filingStatus` currently only adjusts the assumed dependent count. It cannot
affect income, because **spouse income is never collected**. Yet the spec calls
out filing status precisely because it governs whether spousal income counts
under IBR and RAP — which is the single largest lever a married borrower has.

**Rule needed.** Collect spouse income (conditional on a married filing status)
and apply it per plan. Then Married Filing Separately becomes a real, comparable
recommendation rather than a dead input.

### 2.4 Dependents are inferred, not asked

RAP reduces the monthly payment by $50 per dependent. The engine approximates
dependents as `householdSize − 1` (or `− 2` when filing jointly). A household of
4 with one dependent and an elderly parent produces the wrong number, and each
error is worth $50/month.

**Rule needed.** Ask for dependent count directly. It is one field and it is
load-bearing.

### 2.5 "Annual gross income" is not AGI

The form label says gross income. Both IBR and RAP operate on **AGI**. For a
borrower with meaningful above-the-line deductions the gap is thousands of
dollars, and it propagates straight into the payment.

**Rule needed.** Relabel to AGI, explain where to find it (Form 1040 line 11),
and optionally allow gross with a stated caveat.

---

## 3. Consolidation: the advice is incomplete in a costly direction

The engine now checks the June 30 2026 deadline and reports permanent loss of
IDR/PSLF eligibility correctly. Three rules are still missing.

**PSLF payment counts.** Consolidation produces a **weighted average** of the
qualifying counts across consolidated loans; it does not preserve the highest.
A borrower with 100 qualifying payments on one loan and 0 on another does not
emerge with 100. The engine recommends consolidation for PSLF access without
mentioning this. **verify** — this replaced the older full-reset rule, and the
mechanics are worth confirming.

**A second deadline exists.** Reporting indicates consolidations finalising
after July 1 2026 reach **only RAP**, with a March 31 2026 cutoff to retain
legacy IDR access. The config knows about one deadline (`2026-06-30`). This is a
distinct rule with a distinct date. **verify**.

**IDR re-application.** Consolidation resets the IDR plan; the borrower must
reapply with current income and household size. That belongs in the action
checklist.

---

## 4. Time-critical: the SAVE transition is invisible

The spec opens by noting roughly 7.5 million SAVE borrowers must choose a new
plan by **September 30 2026** — days from this audit. The engine cannot express
this at all, because **current repayment plan is not an input**.

The consequences are concrete and expensive:

- Servicers may move non-responders to Standard Repayment around that date.
- Months in SAVE administrative forbearance earn **no PSLF credit** and no IDR
  forgiveness credit — every month of delay is a lost qualifying payment.
- PSLF buyback exists for those months, but is priced at what would have been
  paid and carries a multi-year backlog.

**Rule needed.** Collect current plan. For a SAVE borrower, this outranks every
other recommendation, and the deadline should be computed at runtime the way the
consolidation deadline now is.

---

## 5. Borrower options not modeled at all

| Option | Status | Why it matters |
| --- | --- | --- |
| Tiered Standard (10/15/20/25-yr by balance) | In config, never read | The new default many borrowers land on |
| Extended / Graduated plans | Absent | Relief without IDR's tax-at-forgiveness exposure |
| Deferment / forbearance | Absent | The right answer for short-term hardship |
| Teacher Loan Forgiveness | Absent | Interacts with PSLF; can be sequenced |
| Perkins cancellation | Absent | Occupation-based, and we already collect Perkins |
| State programs | Placeholder only | `stateOfResidence` is collected and unused |
| Employer assistance (§127) | Absent | Up to $5,250/yr tax-free |
| Default / rehabilitation | Absent | A defaulted borrower needs this *first*; no other advice applies |
| Parent PLUS as a distinct type | Not selectable | Has its own ICR-only path and consolidation treatment |

Default status is the notable omission: every recommendation the engine makes is
wrong for a borrower in default, and nothing detects it.

---

## 6. Config declared but never read

`ProviderConfig` is typed and passed in, but **no strategy carries a provider
link**. The spec's "Where to start" table — studentaid.gov for IDR,
consolidation and PSLF; curated lenders for refinancing — is entirely
unimplemented, as is the FTC affiliate disclosure that must accompany the
affiliate entries already sitting in `providers.json`.

Also unread: `repaymentPlans` (so PAYE/ICR/SAVE/Tiered Standard are never
considered), `pslfRules` (including the July 2026 "substantial illegal purpose"
employer exclusion), `comparisonSites`, and `statePrograms`.

This is the gap between the current free teaser and a paid report worth paying
for: the report has nothing to link to.

---

## 7. Recommended order

1. **Lifetime cost alongside monthly change** (§1.1) — stops the misleading claim
2. **Forgiveness tax treatment** (§1.2) — stops the incomplete promise
3. **Current plan input + SAVE handling** (§4) — time-critical, expiring now
4. **Disbursement date → IBR 10/15%** (§2.1) — wrong by 50% for a whole cohort
5. **RAP waiver, match, 30-year term** (§2.2) — needed before any RAP projection
6. **AGI, dependents, spouse income** (§2.3–2.5) — cheap inputs, large effects
7. **Consolidation payment counts and second deadline** (§3)
8. **Provider links and affiliate disclosure** (§6) — what the paid tier sells
9. **Default detection** (§5) — gates everything else
10. Remaining plans and programs (§5)

Items 1, 2 and 3 are the ones that change what a borrower would do.

---

## Sources

[RAP in P.L. 119-21 (CRS)](https://www.congress.gov/crs-product/IF13075) ·
[How RAP works (College Investor)](https://thecollegeinvestor.com/79015/how-the-repayment-assistance-plan-rap-works/) ·
[RAP explained (EdTrust)](https://edtrust.org/blog/how-the-repayment-assistance-plan-rap-works/) ·
[IBR: how it works and what changed (Tate Law)](https://www.tateesq.com/learn/income-based-repayment) ·
[IBR forgiveness 20 or 25 years (Tate Law)](https://www.tateesq.com/learn/student-loan-forgiveness-ibr) ·
[SAVE transition timeline (Student Loan Planner)](https://www.studentloanplanner.com/save-plan-transition-timeline/) ·
[PSLF buyback for SAVE forbearance (NASFAA)](https://www.nasfaa.org/news-item/35514/PSLF_Buyback_Program_A_Way_to_Have_SAVE_Plan_Forbearance_Months_Counted_Towards_Loan_Forgiveness) ·
[Consolidation and PSLF (Student Loan Planner)](https://www.studentloanplanner.com/loan-consolidation-pslf/) ·
[Payments before consolidation and PSLF (studentaid.gov)](https://studentaid.gov/help-center/answers/article/payments-made-before-loan-consolidation-count-toward-pslf) ·
[HHS poverty guidelines (ASPE)](https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines)
