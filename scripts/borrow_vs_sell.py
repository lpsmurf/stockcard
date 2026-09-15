"""Borrow vs sell: what a StockCard member keeps after raising cash.

Run: python3 scripts/borrow_vs_sell.py
All inputs are assumptions for illustration, not tax advice (see docs/borrow-vs-sell.md).

Two ways to raise `need` euros of spendable cash from a portfolio worth `value` with cost basis `basis`:
  SELL   sell enough to net `need` after sale costs and capital gains tax; the rest stays invested.
  BORROW lock the portfolio, borrow `need` (+ payout fee), interest accrues linearly (like the program);
         at the horizon the loan is repaid by selling just enough (and that sale is taxed then).
We compare wealth at the horizon two ways:
  - "held"      market value minus debt, deferred tax not counted (you keep holding)
  - "cashed out" everything sold at the horizon and all tax paid (the strictest comparison)
"""

# StockCard APR bands (parameters.md §3b)
STOCK_BANDS = [(0.20, 0.099), (0.35, 0.129), (0.50, 0.149)]
ITEM_BANDS = [(0.20, 0.119), (0.40, 0.159)]
PAYOUT_FEE = 0.005  # StockCard SEPA fee, Standard tier (parameters.md §3d)


def apr_for(ltv, bands):
    for cap, apr in bands:
        if ltv <= cap:
            return apr
    return None  # above max LTV: not allowed


def tax_on_sale(amount, gain_frac, rate, allowance):
    return max(0.0, amount * gain_frac - allowance) * rate


def gross_up_sale(need, gain_frac, rate, allowance, cost):
    """Sale proceeds S such that S - cost*S - tax(S) = need (bisection)."""
    lo, hi = need, need * 3
    for _ in range(80):
        mid = (lo + hi) / 2
        net = mid - cost * mid - tax_on_sale(mid, gain_frac, rate, allowance)
        lo, hi = (mid, hi) if net < need else (lo, mid)
    return hi


def scenario(name, value, basis, need, rate, allowance, sale_cost, growth, years, bands, divisible=True, apr_override=None):
    gain_frac = max(0.0, (value - basis) / value)

    # SELL now
    if divisible:
        s = gross_up_sale(need, gain_frac, rate, allowance, sale_cost)
        tax_now = tax_on_sale(s, gain_frac, rate, allowance)
        rest_value, rest_basis = value - s, basis * (value - s) / value
    else:  # indivisible item (a watch, a card): must sell all of it
        s = value
        tax_now = tax_on_sale(s, gain_frac, rate, allowance)
        rest_value = rest_basis = 0.0
        need_surplus = s - sale_cost * s - tax_now - need  # cash left over after the purchase
    sell_value_end = rest_value * (1 + growth) ** years
    sell_held = sell_value_end + (0 if divisible else need_surplus)
    sell_cashed = sell_held - sale_cost * sell_value_end - tax_on_sale(sell_value_end, max(0, (sell_value_end - rest_basis) / sell_value_end) if sell_value_end else 0, rate, allowance)

    # BORROW now
    loan = need / (1 - PAYOUT_FEE)
    ltv = loan / value
    apr = apr_override if apr_override is not None else apr_for(ltv, bands)
    if apr is None:
        return name, None
    debt_end = loan * (1 + apr * years)
    value_end = value * (1 + growth) ** years
    borrow_held = value_end - debt_end
    borrow_cashed = value_end - sale_cost * value_end - tax_on_sale(value_end, (value_end - basis) / value_end, rate, allowance) - debt_end
    ltv_end = debt_end / value_end
    drop_to_liq = 1 - debt_end / (0.65 * value)  # price fall (from today) that hits 65% at the horizon's debt

    return name, dict(breakeven=None, sale=s, tax_now=tax_now, ltv=ltv, apr=apr, interest=debt_end - loan,
                      sell_held=sell_held, borrow_held=borrow_held, sell_cashed=sell_cashed, borrow_cashed=borrow_cashed,
                      ltv_end=ltv_end, drop_to_liq=drop_to_liq)


def breakeven_apr(**kw):
    """APR at which borrowing and selling leave the same wealth when everything is cashed out."""
    lo, hi = 0.0, 0.60
    f = lambda a: scenario("", apr_override=a, **kw)[1]
    if f(lo)["borrow_cashed"] < f(lo)["sell_cashed"]:
        return 0.0
    for _ in range(60):
        mid = (lo + hi) / 2
        r = f(mid)
        lo, hi = (mid, hi) if r["borrow_cashed"] > r["sell_cashed"] else (lo, mid)
    return lo


def run(name, **kw):
    r = scenario(name, **kw)[1]
    if r is not None:
        r["breakeven"] = breakeven_apr(**{k: v for k, v in kw.items() if k != "apr_override"})
    return (name, r)


def table(title, rows):
    print(f"\n### {title}\n")
    print("| Case | Sell now: tax paid today | Borrow: LTV · APR | Interest over period | Wealth if held: sell → borrow | Wealth if all cashed out: sell → borrow | Borrow ahead by (cashed out) | Break-even APR |")
    print("|---|---|---|---|---|---|---|---|")
    for name, r in rows:
        if r is None:
            print(f"| {name} | — | above max LTV | — | — | — | — | — |")
            continue
        diff = r["borrow_cashed"] - r["sell_cashed"]
        print(f"| {name} | €{r['tax_now']:,.0f} | {r['ltv']*100:.1f}% · {r['apr']*100:.1f}% | €{r['interest']:,.0f} | €{r['sell_held']:,.0f} → €{r['borrow_held']:,.0f} | €{r['sell_cashed']:,.0f} → €{r['borrow_cashed']:,.0f} | **{'+' if diff >= 0 else '−'}€{abs(diff):,.0f}** | {"never" if r['breakeven'] == 0 else f"{r['breakeven']*100:.1f}%"} |")


if __name__ == "__main__":
    # A. Germany, car: €150k portfolio bought for €60k, need €40k. Abgeltungssteuer 26.375% (incl. Soli), €1,000 allowance.
    DE = dict(value=150_000, basis=60_000, need=40_000, rate=0.26375, allowance=1_000, sale_cost=0.0025, bands=STOCK_BANDS)
    table("A. Germany · €40k for a car from a €150k stock portfolio (basis €60k)", [
        run("1 year, stocks +7%/yr", growth=0.07, years=1, **DE),
        run("2 years, stocks +7%/yr", growth=0.07, years=2, **DE),
        run("3 years, stocks +7%/yr", growth=0.07, years=3, **DE),
        run("1 year, stocks flat", growth=0.0, years=1, **DE),
        run("1 year, stocks −20%", growth=-0.20, years=1, **DE),
    ])
    table("A3. Same car case at broker Lombard rates (IBKR EUR ~3.7%, German Wertpapierkredit ~5–7%)", [
        run("1 year at 3.7%", growth=0.07, years=1, apr_override=0.037, **DE),
        run("3 years at 3.7%", growth=0.07, years=3, apr_override=0.037, **DE),
        run("3 years at 6.0%", growth=0.07, years=3, apr_override=0.06, **DE),
    ])
    table("A2. Same, but a smaller loan: €25k (lower LTV band 9.9%)", [
        run("1 year, +7%/yr", growth=0.07, years=1, **{**DE, "need": 25_000}),
        run("3 years, +7%/yr", growth=0.07, years=3, **{**DE, "need": 25_000}),
    ])

    # B. Belgium, house deposit: new 10% capital gains tax from 2026, ~€10k annual exemption. €400k portfolio, basis €150k, need €100k.
    BE = dict(value=400_000, basis=150_000, need=100_000, rate=0.10, allowance=10_000, sale_cost=0.0035, bands=STOCK_BANDS)
    table("B. Belgium · €100k house deposit from a €400k portfolio (basis €150k), 10% tax", [
        run("1 year, +7%/yr", growth=0.07, years=1, **BE),
        run("3 years, +7%/yr", growth=0.07, years=3, **BE),
    ])

    # C. Netherlands 2028 plan: box 3 taxes unrealised gains every year, so selling triggers no extra tax. Model rate 0 at sale.
    NL = dict(value=150_000, basis=60_000, need=40_000, rate=0.0, allowance=0, sale_cost=0.0025, bands=STOCK_BANDS)
    table("C. Netherlands (box 3, no tax event on sale) · €40k from €150k", [
        run("1 year, +7%/yr", growth=0.07, years=1, **NL),
        run("3 years, +7%/yr", growth=0.07, years=3, **NL),
    ])

    # D. A watch you can't sell in part: €60k Daytona bought for €25k, need €15k. Dealer/auction costs ~15%.
    #    Germany: private sale of personal items held > 1 year is generally tax-free (rate 0 here).
    W = dict(value=60_000, basis=25_000, need=15_000, rate=0.0, allowance=0, sale_cost=0.15, bands=ITEM_BANDS, divisible=False)
    table("D. Watch · €15k from a €60k watch (must sell it whole, ~15% dealer/auction cost)", [
        run("1 year, watch +5%/yr", growth=0.05, years=1, **W),
        run("2 years, watch +5%/yr", growth=0.05, years=2, **W),
        run("1 year, watch flat", growth=0.0, years=1, **W),
    ])
