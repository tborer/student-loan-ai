# Expert Review — Does This App Serve a Real Borrower Well?

2026-09-19 · reviewed as a student loan repayment counselor would, walking the
live form → engine → results path rather than auditing code in the abstract.

## Framing

This is a different lens from `engine-rules-gap-analysis.md`, which asked "is
the math right." This asks "if a real borrower used this today, would they
get sound advice, and would anything it tells them be actively wrong or
dangerously incomplete." Some findings below overlap with that doc; where
they do, I say so rather than re-deriving them.

**Verdict up front:** the four strategies it models, it now models
correctly, and the free-tier discipline (headlines only, no dollar figures)
is the right call. But the tool has a blind spot that matters more than any
calculation bug: it only knows how to talk to a borrower whose situation is
current, federal, and Direct. A meaningful share of real borrowers aren't
that, and for one segment specifically, the tool doesn't just have nothing
to offer — it gives an answer that's wrong.

---

## 1. A verified, high-stakes misclassification: Parent PLUS

I checked this against the code, not just against general knowledge.

The loan-type dropdown offers **`Direct PLUS`** as a single option. The
engine classifies eligibility with:

```ts
const isDirect = (type: Loan['type']): boolean => type.startsWith('Direct');
```

`isDirect('Direct PLUS')` returns `true`, so a Direct PLUS loan is treated
identically to a Direct Subsidized/Unsubsidized loan for IDR and PSLF
purposes.

That's correct for a **Grad PLUS** loan (a graduate student's own debt) but
wrong for a **Parent PLUS** loan (a parent's debt for a dependent's
undergraduate education) — and the form gives no way to tell the two apart.

Parent PLUS loans are **excluded from RAP entirely**. The only IDR path they
ever had was ICR, and only after consolidating into a Direct Consolidation
Loan — and that consolidation had to be **fully disbursed by June 30, 2026**
to preserve even that. For anyone who didn't already consolidate before that
date, Parent PLUS loans have **no IDR path at all** going forward. [Source](https://thecollegeinvestor.com/45655/why-parent-plus-loans-are-ineligible-for-income-driven-repayment-plans/), [source](https://www.tateesq.com/learn/parent-plus-loan-repayment).

So today, a parent who enters their Parent PLUS balance sees RAP and IBR
offered as real options with real dollar figures. That isn't an
approximation that's off by a little — it's telling someone a road is open
that is closed. This is the one finding in this review I'd call urgent
rather than important.

**Fix:** split `Direct PLUS` into `Direct PLUS (Grad)` and `Direct PLUS
(Parent)` in the loan-type list, and gate RAP/IBR eligibility on the
distinction — excluded for Parent PLUS outright, or eligible only via the
narrow already-consolidated-before-the-deadline ICR path, which itself sunsets
to IBR by June 30, 2028.

---

## 2. A free, low-risk, time-sensitive lever the tool never mentions

Starting July 1, 2026, the autopay interest-rate discount jumped from its
old 0.25% to **1%**, temporarily, through June 30, 2028 — for any Direct
Loan borrower who enrolls in autopay by **September 30, 2026**. [Source](https://www.cnbc.com/2026/06/24/student-loan-borrowers-interest-rate-discount.html), [source](https://www.nasfaa.org/news-item/39196/ED_Announces_Temporary_1_Interest_Rate_Reduction_for_Borrowers_Enrolled_in_Auto_Pay).

That deadline is **days away** as I write this, in the same way the
SAVE-transition deadline is. Unlike every strategy the tool models, this one
requires no eligibility analysis, carries no trade-off, forfeits nothing,
and applies to nearly every federal borrower. It's the single highest
confidence, lowest-risk recommendation available right now, and the tool
says nothing about it.

This isn't a strategy the engine needs to rank against the other four — it's
closer to a banner that belongs on every results page for a federal
borrower, the same way the SAVE-transition urgency should be. Both are
"there is a deadline this week and most visitors don't know it" facts, which
is exactly the kind of thing a paid analysis tool exists to surface.

---

## 3. Situations the tool has nothing to say to

The engine's ranking logic assumes the borrower is current on payments and
in one of four boxes: refinance-eligible, IDR-eligible, consolidation-
eligible, or PSLF-eligible. Real borrowers include people the tool is
currently silent on entirely:

**Already in default.** Nothing in the form asks, and nothing in the output
changes if they are. This matters because *every other recommendation the
tool makes is premature* for someone in default — rehabilitation or
consolidation out of default comes first, and it changes what "eligible for
IDR" even means (a rehabilitated loan can move straight into an IDR plan;
one exiting default via consolidation needs to reapply). A borrower in
default who uses this tool gets advice for a version of their situation they
don't have.

**Disability, closed-school, or borrower-defense discharge candidates.**
Total and Permanent Disability Discharge, Closed School Discharge, and
Borrower Defense to Repayment are all live, processing programs in 2026 —
[TPD is active](https://studentaid.gov/sites/default/files/TotalandPermanentDisabilityDischargeApplication-en-us.pdf), and [borrower defense claims are being reviewed and paid](https://www.forbes.com/sites/adamminsky/2026/05/22/strict-limits-on-discharging-student-loans-to-remain-after-court-dismisses-challenge/) under the 2019 standard restored by the 2025 reconciliation law. None of the four modeled strategies apply to someone who may be eligible to have the debt discharged outright, and the tool has no question that would ever surface that possibility.

**Private-loan hardship.** The tool correctly tells an all-private borrower
to consider refinancing, but says nothing about what they should do if
they're struggling *right now*. Private lenders aren't required to offer
forbearance the way federal servicers are — some do, many don't, and terms
vary enormously by lender. A borrower in hardship with private loans needs
to know to call their servicer and ask directly, which the tool never
prompts.

**IDR recertification and payment shock.** Every IDR/RAP strategy the tool
shows assumes the payment it calculates today holds for the whole term. In
reality, IDR payments recalculate annually against updated income and
household size, and a borrower who misses recertification can be moved to a
standard payment overnight — sometimes a very large one. The tool presents a
single number with no mention that it's a snapshot, not a fixed plan.

None of this means the tool needs to solve every one of these — but it
should ask enough to know when a borrower is in one of these situations, and
say so rather than silently proceeding as if they're a routine case. A
one-line question ("Are you currently behind on payments, or in default?")
would catch the highest-stakes case cheaply.

---

## 4. A paywall choice I'd revisit: the mandatory federal-forfeiture warning is locked

The engine already generates this, verbatim, whenever a federal borrower's
refinance strategy is shown:

> "Refinancing a federal loan converts it to private debt and permanently
> forfeits IDR, RAP, PSLF, deferment and forgiveness eligibility. This
> cannot be undone."

I checked `app/results/page.tsx`: the free tier renders only `strategy.title`
for each card. `warnings` — which is where this text lives — is never read
by the page at all. It exists only in the (still-unbuilt) paid report.

That's a defensible instinct for *numbers* — a fuzzy savings range is the
free tier's whole design, per spec. It's a different call for an
**irreversible risk warning**. A free-tier visitor who's leaning toward
refinancing and closes the tab before paying gets zero indication that the
choice they're leaning toward is permanent. A responsible tool doesn't
paywall the warning, only the analysis. I'd surface `warnings` on the free
tier regardless of payment status — it costs nothing to give away and it's
the difference between "informational" and "letting someone hurt themselves
for want of $9."

---

## 5. The tool never explains what it is versus what's free elsewhere

For-profit "student loan debt relief" companies charging borrowers hundreds
or thousands of dollars for IDR applications, consolidation, or PSLF
certification — services that are **100% free directly through
studentaid.gov** — is a well-documented, FTC-flagged pattern. This app is
legitimately different: it's selling *comparison and analysis across options
a borrower would otherwise have to research separately*, including real
refinance-lender comparison that studentaid.gov's own Loan Simulator doesn't
do (it's not a lender). But nowhere does the app say so.

Right now a first-time visitor has no way to distinguish this from the
pattern they've likely been warned about. One sentence — "Enrolling in IDR,
consolidating, and applying for PSLF are always free directly through
studentaid.gov; this report is a comparison across all your options,
including private refinancing, in one place" — costs nothing and does two
things at once: it's the honest disclosure, and it's better marketing than
silence, because it preempts the skepticism a savvy borrower will otherwise
bring.

---

## 6. Where the free content should point people first

There's no "how to find your own loan information" guidance anywhere in the
flow. A real borrower is often unsure of their own loan types, current
servicer, or exact balances — student loans get transferred between
servicers often enough that "check studentaid.gov, log in, and look at My
Aid" is a genuinely necessary first step for a meaningful fraction of
visitors before they can even fill out this form accurately. Pointing people
there isn't competing with the paid product; it's what makes the numbers
they enter trustworthy in the first place.

---

## 7. What the tool gets right, worth saying plainly

- The four strategies it does model — refinance, IBR, RAP, PSLF, plus
  consolidation's eligibility consequences — are now calculated correctly,
  including the lifetime-cost and forgiveness-tax-treatment work from the
  last round of fixes. That's real, substantive counseling logic, not just
  arithmetic.
- Omitting an ineligible strategy entirely, rather than showing it grayed
  out as "not recommended," is the right instinct — it keeps the tool from
  ever implying something is an option when it isn't.
- The free tier's discipline about not leaking dollar figures is correctly
  implemented (verified in the DOM, not just assumed).
- The consolidation-deadline handling (§1.1 of the prior gap analysis) is a
  genuinely good example of the tool doing something most free calculators
  don't: checking today's date against a real regulatory deadline and
  changing its answer accordingly.

---

## 8. What I'd fix first

Priority is by "how badly could this mislead someone," not by effort:

1. **Parent PLUS misclassification (§1)** — this is the one place the tool
   is currently wrong, not just incomplete. Split the loan type and gate
   eligibility correctly.
2. **A default/hardship question on the form** — cheap to add, and it's the
   one missing input that changes whether *every other* recommendation even
   applies.
3. **Surface `warnings` on the free tier (§4)** — the forfeiture warning
   already exists in the engine; it just needs to be read by the page.
4. **The autopay-discount banner (§2)** and the **SAVE-transition urgency**
   already flagged in the prior review — both are free, time-sensitive,
   near-zero-risk facts that belong on the results page regardless of what
   else a borrower qualifies for.
5. **The "this is free elsewhere, here's what we add" disclosure (§5)** —
   one sentence, meaningful trust and legal-risk payoff.
6. **Point to studentaid.gov as step zero (§6)** before the form, not after.
7. **Disability/closed-school/borrower-defense and default-rehabilitation
   as a "you may not need any of this" branch (§3)** — doesn't need full
   modeling, but a borrower who might qualify for outright discharge should
   never see four repayment strategies with nothing pointing at door zero.

Items 1–3 are code changes I can make directly. Items 4–7 are mostly content
and one added form question — small individually, and together they're the
difference between a calculator and something that actually counsels.

## Sources

[Parent PLUS ineligible for IDR (College Investor)](https://thecollegeinvestor.com/45655/why-parent-plus-loans-are-ineligible-for-income-driven-repayment-plans/) ·
[Parent PLUS repayment options 2026 (Tate Law)](https://www.tateesq.com/learn/parent-plus-loan-repayment) ·
[Federal autopay discount raised to 1% (CNBC)](https://www.cnbc.com/2026/06/24/student-loan-borrowers-interest-rate-discount.html) ·
[ED announces autopay interest reduction (NASFAA)](https://www.nasfaa.org/news-item/39196/ED_Announces_Temporary_1_Interest_Rate_Reduction_for_Borrowers_Enrolled_in_Auto_Pay) ·
[TPD discharge application (studentaid.gov)](https://studentaid.gov/sites/default/files/TotalandPermanentDisabilityDischargeApplication-en-us.pdf) ·
[Borrower defense standard restored, claims processing (Forbes)](https://www.forbes.com/sites/adamminsky/2026/05/22/strict-limits-on-discharging-student-loans-to-remain-after-court-dismisses-challenge/) ·
[Forgiveness programs still open in 2026 (Tate Law)](https://www.tateesq.com/learn/how-to-apply-for-student-loan-forgiveness)
