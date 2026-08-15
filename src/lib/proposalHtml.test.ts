import { describe, expect, it } from "vitest";
import { buildProposalHtml } from "./proposalHtml";
import { createEstimate } from "./newEstimate";
import { defaultSettings } from "./settings";
import type { Estimate } from "../types/estimate";

// This HTML is loaded into an Electron BrowserWindow and printed to PDF
// (electron/main.ts, pdf:export). Unescaped user text here can execute
// script or load a remote URL in that window, see proposalHtml.ts's `esc`
// helper. These tests lock in that every free-text field is escaped.

const SCRIPT_PAYLOAD = "<script>alert(1)</script>";
const IMG_PAYLOAD = '<img src=x onerror="alert(1)">';

function maliciousEstimate(pricingMethod: Estimate["pricingMethod"]): Estimate {
  const estimate = createEstimate(defaultSettings());
  estimate.pricingMethod = pricingMethod;
  estimate.projectDetails = {
    ...estimate.projectDetails,
    estimateName: SCRIPT_PAYLOAD,
    clientName: IMG_PAYLOAD,
    preparerName: SCRIPT_PAYLOAD,
  };
  estimate.assumptions = [IMG_PAYLOAD];
  estimate.exclusions = [SCRIPT_PAYLOAD];
  estimate.expenses = [{ id: "x1", label: IMG_PAYLOAD, amount: 100 }];
  estimate.timeMaterials = {
    workPackages: [{ id: "w1", name: IMG_PAYLOAD, optimisticDays: 1, likelyDays: 2, pessimisticDays: 4, roleId: "r1" }],
    useRoleBasedPricing: true,
    roles: [{ id: "r1", name: SCRIPT_PAYLOAD, dayRate: 100 }],
    paymentSplit: [{ label: IMG_PAYLOAD, pct: 100 }],
    isFixedPrice: false,
    fixedPriceRiskCoveragePct: 30,
  };
  estimate.valueBased = {
    ...estimate.valueBased,
    tiers: estimate.valueBased.tiers.map((t, i) =>
      i === 0 ? { ...t, name: SCRIPT_PAYLOAD, description: SCRIPT_PAYLOAD } : t,
    ),
  };
  return estimate;
}

describe("buildProposalHtml", () => {
  const cases: Array<["time-materials" | "value-based", "client" | "internal"]> = [
    ["time-materials", "client"],
    ["time-materials", "internal"],
    ["value-based", "client"],
    ["value-based", "internal"],
  ];

  it.each(cases)("escapes malicious %s/%s input instead of emitting raw HTML", (pricingMethod, tab) => {
    const estimate = maliciousEstimate(pricingMethod);
    const { html } = buildProposalHtml(estimate, tab);

    expect(html).not.toContain(SCRIPT_PAYLOAD);
    expect(html).not.toContain(IMG_PAYLOAD);
    expect(html.toLowerCase()).not.toContain("<script>alert");
    expect(html.toLowerCase()).not.toContain("<img src=x");

    // The escaped form should still be present somewhere in the document.
    expect(html).toContain("&lt;script&gt;");
  });

  it("still renders normal text unescaped-looking (no double-escaping)", () => {
    const estimate = createEstimate(defaultSettings());
    estimate.projectDetails.estimateName = "Acme & Co";
    const { html } = buildProposalHtml(estimate, "client");
    expect(html).toContain("Acme &amp; Co");
    expect(html).not.toContain("Acme &amp;amp; Co");
  });

  function fixedPriceEstimate(): Estimate {
    const estimate = createEstimate(defaultSettings());
    estimate.pricingMethod = "time-materials";
    estimate.timeMaterials = {
      ...estimate.timeMaterials,
      workPackages: [{ id: "w1", name: "Discovery", optimisticDays: 2, likelyDays: 4, pessimisticDays: 8, roleId: undefined }],
      isFixedPrice: true,
    };
    return estimate;
  }

  it("client overview HTML quotes the not-to-exceed cap and drops NTE language in fixed-price mode", () => {
    const estimate = fixedPriceEstimate();
    const { html } = buildProposalHtml(estimate, "client");
    expect(html).toContain("Fixed Price Quote");
    expect(html).toContain("Fixed Price");
    expect(html).not.toContain("not-to-exceed");
    expect(html).not.toMatch(/Not-to-exceed cap/i);
  });

  it("internal detail HTML shows the risk-adjusted build-up and effective day rate in fixed-price mode", () => {
    const estimate = fixedPriceEstimate();
    const { html } = buildProposalHtml(estimate, "internal");
    expect(html).toContain("PRICING STRUCTURE");
    expect(html).toContain("Risk Coverage (30% of");
    expect(html).toContain("Fixed Price (Quote This)");
    expect(html).toContain("Expected Cost (Internal Reference, Not Shown to Client)");
    expect(html).toContain("Not-to-Exceed Ceiling (Internal Reference, 100% Risk Coverage)");
    expect(html).toContain("Effective Day Rate");
    expect(html).not.toContain("NTE CAP BASIS");
    // Risk coverage is only shown as its own cost build-up line, not
    // repeated in the header meta tile.
    expect(html).toContain('<span class="label">PRICING STRUCTURE</span><span class="value">Fixed Price</span>');
  });

  it("a higher risk-coverage percentage quotes a higher fixed price in both client and internal HTML", () => {
    const low = fixedPriceEstimate();
    low.timeMaterials.fixedPriceRiskCoveragePct = 0;
    const high = fixedPriceEstimate();
    high.timeMaterials.fixedPriceRiskCoveragePct = 100;

    const lowClientHtml = buildProposalHtml(low, "client").html;
    const highClientHtml = buildProposalHtml(high, "client").html;
    expect(lowClientHtml).not.toEqual(highClientHtml);

    const lowInternalHtml = buildProposalHtml(low, "internal").html;
    const highInternalHtml = buildProposalHtml(high, "internal").html;
    expect(lowInternalHtml).toContain("Risk Coverage (0% of");
    expect(highInternalHtml).toContain("Risk Coverage (100% of");
  });

  it("variable (non-fixed) mode HTML is unaffected and still shows not-to-exceed language", () => {
    const estimate = createEstimate(defaultSettings());
    estimate.pricingMethod = "time-materials";
    estimate.timeMaterials.workPackages = [
      { id: "w1", name: "Discovery", optimisticDays: 2, likelyDays: 4, pessimisticDays: 8, roleId: undefined },
    ];
    const clientHtml = buildProposalHtml(estimate, "client").html;
    const internalHtml = buildProposalHtml(estimate, "internal").html;
    expect(clientHtml).toContain("not-to-exceed");
    expect(clientHtml).toContain("Estimated Investment");
    expect(internalHtml).toContain("NTE CAP BASIS");
    expect(internalHtml).toContain("Not-to-Exceed Cap</span>");
    expect(internalHtml).toContain("Effective Day Rate");
  });
});
