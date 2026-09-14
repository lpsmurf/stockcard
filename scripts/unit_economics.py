"""StockCard unit economics: monthly contribution per member by tier.

Run: python3 scripts/unit_economics.py
All inputs are assumptions (see docs/unit-economics.md). Change them here, re-run, paste the output.
"""

# ---- market / program assumptions (per month unless noted) ----
PROTOCOL_SHARE = 0.40          # share of borrower interest kept by StockCard (rest goes to savers)
INTERCHANGE_KEPT = 0.001       # EU consumer debit cap 0.2%, assume half reaches us after issuer/program manager
FX_SHARE_OF_SPEND = 0.20       # share of spend in a foreign currency
FX_MARKUP = 0.01               # markup on foreign spend for tiers without 0% FX
CARD_COST = {"virtual": 1.00, "physical": 1.50, "metal": 2.75}  # program fee + card amortized, EUR/month
LOSS_RATE_YEAR = 0.015         # expected credit loss on drawn balance per year (after liquidations)
PERKS_COST = {"Standard": 0.0, "Plus": 1.0, "Black": 6.0}       # support, lounges/insurance budget
BASE_APR = 0.129               # middle stock band (20-35% LTV)
APR_FLOOR = 0.089


def member(tier, fee, cashback, cap, above_cap, apr_discount, card, zero_fx, spend, balance, founding=False):
    apr = max(APR_FLOOR, BASE_APR - apr_discount - (0.02 if founding else 0))
    interest = balance * apr / 12 * PROTOCOL_SHARE
    interchange = spend * INTERCHANGE_KEPT
    fx = 0 if zero_fx else spend * FX_SHARE_OF_SPEND * FX_MARKUP
    revenue = fee + interest + interchange + fx
    cb = min(spend, cap) * cashback + max(0, spend - cap) * above_cap
    loss = balance * LOSS_RATE_YEAR / 12
    cost = cb + loss + CARD_COST[card] + PERKS_COST[tier]
    return dict(tier=tier, spend=spend, balance=balance, apr=apr, revenue=revenue, cashback=cb, cost=cost, net=revenue - cost)


def run(title, tiers, profiles, founding=False):
    print(f"\n### {title}\n")
    print("| Tier | Profile | Spend €/mo | Balance € | APR | Revenue | Cashback | All costs | **Net €/mo** |")
    print("|---|---|---|---|---|---|---|---|---|")
    for name, t in tiers.items():
        for pname, (spend, bal) in profiles[name].items():
            r = member(name, *t, spend=spend, balance=bal, founding=founding)
            print(f"| {name} | {pname} | {spend:,} | {bal:,} | {r['apr']*100:.1f}% | {r['revenue']:.2f} | {r['cashback']:.2f} | {r['cost']:.2f} | **{r['net']:+.2f}** |")


# (fee, cashback, cap, above_cap, apr_discount, card, zero_fx)
PROPOSED_SEPT14 = {
    "Standard": (0.00, 0.010, 1000, 0.005, 0.00, "virtual", False),
    "Plus": (9.99, 0.020, 2000, 0.010, 0.01, "physical", False),
    "Black": (29.99, 0.030, 3000, 0.010, 0.02, "metal", True),
}
REVISED = {
    "Standard": (0.00, 0.005, 1000, 0.0025, 0.00, "virtual", False),
    "Plus": (9.99, 0.015, 1500, 0.005, 0.01, "physical", False),
    "Black": (29.99, 0.025, 3000, 0.010, 0.01, "metal", True),
}
PROFILES = {
    "Standard": {"typical": (600, 1500), "spender, low balance": (1000, 500)},
    "Plus": {"typical": (1500, 5000), "spender, low balance": (2000, 1500)},
    "Black": {"typical": (3000, 15000), "spender, low balance": (3000, 5000)},
}

def member_v3(tier, fee, cashback, cap, share_of_balance, above_cap, apr_discount, card, zero_fx,
              spend, balance, founding_cap=0.0):
    """Top cashback rate only on spend up to min(cap, share_of_balance x balance) per month (credit-linked)."""
    apr = max(APR_FLOOR, BASE_APR - apr_discount)
    interest = balance * apr / 12 * PROTOCOL_SHARE
    founding_cost = min(balance, founding_cap) * 0.02 / 12 * PROTOCOL_SHARE
    revenue = fee + interest - founding_cost + spend * INTERCHANGE_KEPT + (0 if zero_fx else spend * FX_SHARE_OF_SPEND * FX_MARKUP)
    top = min(spend, cap, share_of_balance * balance)
    cb = top * cashback + (spend - top) * above_cap
    cost = cb + balance * LOSS_RATE_YEAR / 12 + CARD_COST[card] + PERKS_COST[tier]
    return revenue, cb, cost, revenue - cost, apr


# (fee, top cashback, spend cap, share of balance, rate above, apr_discount, card, zero_fx)
RECOMMENDED = {
    "Standard": (0.00, 0.005, 1000, 0.25, 0.0025, 0.00, "virtual", False),
    "Plus": (9.99, 0.015, 2000, 0.25, 0.005, 0.01, "physical", False),
    "Black": (39.99, 0.025, 4000, 0.25, 0.0075, 0.00, "metal", True),
}


def run_v3(title, tiers, profiles, founding_cap=0.0, **overrides):
    g = globals()
    saved = {k: g[k] for k in overrides}
    g.update(overrides)
    print(f"\n### {title}\n")
    print("| Tier | Profile | Spend €/mo | Balance € | APR | Revenue | Cashback | All costs | **Net €/mo** |")
    print("|---|---|---|---|---|---|---|---|---|")
    for name, t in tiers.items():
        for pname, (spend, bal) in profiles[name].items():
            rev, cb, cost, net, apr = member_v3(name, *t, spend=spend, balance=bal, founding_cap=founding_cap)
            print(f"| {name} | {pname} | {spend:,} | {bal:,} | {apr*100:.1f}% | {rev:.2f} | {cb:.2f} | {cost:.2f} | **{net:+.2f}** |")
    g.update(saved)


if __name__ == "__main__":
    run("A. Sept 14 proposal (1% / 2% / 3% on spend), base case", PROPOSED_SEPT14, PROFILES)
    run("B. Lower spend-based rates (0.5% / 1.5% / 2.5%), base case", REVISED, PROFILES)
    run_v3("C. Recommended: credit-linked cashback, Black €39.99, base case", RECOMMENDED, PROFILES)
    run_v3("D. Recommended + founding −2 pt APR on first €5,000 of balance", RECOMMENDED, PROFILES, founding_cap=5000)
    run_v3("E. Stress: recommended with 3% annual credit losses and 35% protocol share", RECOMMENDED, PROFILES,
           LOSS_RATE_YEAR=0.03, PROTOCOL_SHARE=0.35)
    run_v3("F. Upside: recommended with non-EEA interchange (0.5% kept)", RECOMMENDED, PROFILES, INTERCHANGE_KEPT=0.005)
