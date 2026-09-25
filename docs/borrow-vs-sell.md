# Borrow, don't sell: when it's actually better

Why people borrow against stocks, collectibles and art instead of selling, where it really saves money, where it doesn't, and what that means for StockCard's pricing and pitch. Written Sept 15, 2026. Numbers come from `scripts/borrow_vs_sell.py` (run it to reproduce). **Not tax advice**: rules differ by country and change; every example is a simplified illustration.

## The short answer

- Borrowing against assets is how wealthy people have always raised cash (private-bank "Lombard" loans, securities-based lending, art loans). The reasons are real: you keep ownership and upside, you don't trigger a taxable sale, you avoid selling costs and bad timing, and you get money in minutes instead of days or months.
- **But borrowing only postpones tax, and interest is a cost too.** In our model, with stocks returning 7% a year, borrowing beats selling on a "sell everything later" basis only when the APR is below about **5–7%** for stocks. At StockCard's current stock APRs (9.9–14.9%), **selling is cheaper over 1–3 years in most stock cases**, unless the loan is short and repaid from income.
- **For collectibles, watches and art the picture flips.** They can't be sold in part, selling costs 10–25%, a sale can take months, and banks don't lend against them for normal customers. At 15.9% APR, borrowing is roughly break-even with selling after costs, and you keep the item.
- So the honest pitch is: **"Get cash from what you own in minutes, without selling it"**, strongest for collectibles, art and on-chain stock holders, and for short-term needs. Not "borrowing is always cheaper than paying tax."

## 1. Why borrowing instead of selling makes sense

| Advantage | What it means for the member | How strong |
|---|---|---|
| **No taxable sale now** | Selling realises a capital gain; a loan is not income and not a sale. Tax is deferred until you eventually sell, and in some cases avoided (see §3) | Strong for large unrealised gains and short loans; weak where there's no tax on sale (NL box 3) |
| **Keep the upside** | The whole portfolio stays invested; if it grows faster than the APR, you're ahead | Depends on APR vs expected return |
| **Keep income** | Dividends keep accruing (xStocks reflect them through the Scaled UI multiplier) | Moderate |
| **Keep the thing itself** | A Rolex, a PSA 10 Charizard or a painting can't be sold "10% of it". Borrowing lets you raise €15k without giving up a €60k watch | **Very strong for collectibles/art** |
| **No selling costs** | Stocks: spread + fees (~0.1–0.5%). Watches: dealer buy prices well under retail. Graded cards: marketplace fees. Art: auction commissions and buyer's premiums that often total 20%+ | Strong for collectibles/art |
| **No forced timing** | Need money during a market dip? Selling locks in the loss; borrowing lets you wait | Strong, but see liquidation risk |
| **Speed** | On-chain loan in one signature, card spend immediately, SEPA Instant to a bank in seconds. Selling stocks: T+1 settlement then a bank transfer. Selling art: weeks to months | Strong |
| **No credit score / income check (today)** | The collateral secures the loan. Note: the EU Consumer Credit Directive 2023/2225 applies from **20 Nov 2026** and brings creditworthiness rules for consumer loans; counsel must confirm our obligations | Temporary; don't lead with it |
| **Flexible repayment** | No fixed schedule; repay anytime without penalty; interest accrues only on what's drawn | Moderate |
| **Keep your long-term plan** | Selling and rebuying breaks compounding and invites market-timing mistakes | Moderate (behavioural) |

## 2. The catch: interest, liquidation, and tax that only moves

**Interest compounds against you.** €40,000 at 12.9% costs about €5,190 a year. The tax you avoided by not selling is still owed when you eventually sell.

**Liquidation can force the sale anyway, at the worst price.** At 26.8% LTV (the €40k example), the position is liquidated at 65% LTV, meaning a fall of about 59% from today. A forced sale also realises the gain and triggers the tax you were trying to postpone.

**Selling your way is sometimes simply cheaper.** Break-even APRs from the model (everything sold at the end, all tax paid):

| Case (assumptions in §5) | Tax if you sell today | StockCard APR | Borrowing vs selling, 1 year | Break-even APR |
|---|---|---|---|---|
| Germany, €40k from €150k stocks (gain 60%) | €7,229 | 12.9% | **−€3,219** | 4.9% (1 yr) · 6.1% (3 yrs) |
| Germany, same, at a broker's 3.7% | €7,229 | 3.7% | **+€480** (1 yr) · **+€2,891** (3 yrs) | — |
| Germany, smaller €25k loan | €4,401 | 9.9% | **−€1,363** | 4.5% |
| Belgium, €100k house deposit from €400k (10% tax) | €5,625 | 12.9% | **−€7,816** | 5.1% |
| Netherlands, €40k from €150k (no tax on sale) | €0 | 12.9% | **−€2,587** | 6.5% |
| €15k from a €60k watch, +5%/yr, ~15% selling cost | €0 | 15.9% | **+€78** (keep the watch) | 16.4% |
| Same watch, flat price | €0 | 15.9% | **−€2,472** | never |
| Germany stocks, prices fall 20% in the year | €7,229 | 12.9% | **−€12,599** | never |

Reading it: when you plan to sell eventually anyway, the loan has to cost less than what the assets earn (minus the value of postponing tax). That's roughly 5–7% for a stock portfolio expected to earn 7%. If prices fall, having sold earlier always wins.

**Where borrowing clearly wins on money:**
1. **Short bridges repaid from income.** A 6-month €40k loan at 12.9% costs ~€2,590 in interest, against €7,229 tax plus trading costs paid today and 27% of the portfolio taken out of the market. If you never needed to sell, the tax may never be due in that form.
2. **Assets with high selling costs or that can't be split.** Watches, graded cards, art (table above).
3. **Low APR.** At broker-like rates (3.7–6%) borrowing beats selling in the German example over 1–3 years.
4. **Long-term holders who won't sell for decades.** Deferral compounds; in some systems tax on the gain is never collected in that form (for example the US "step-up in basis" at death; our EU markets mostly don't have this).

## 3. Tax by country (the parts that matter for this decision)

Simplified, 2026, for residents holding directly. Tokenized stocks (xStocks are tracker certificates) can be taxed differently from shares; always confirm.

| Country | Tax when you sell | Effect on borrow-vs-sell |
|---|---|---|
| **Germany** | Abgeltungssteuer 25% + solidarity surcharge = **26.375%** (plus church tax if applicable), €1,000 annual allowance (Sparerpauschbetrag). Private sale of personal items (watches, art, collectibles) held **over 1 year is generally tax-free** (§23 EStG) | Big deferral for stocks with gains; for collectibles the advantage is selling costs, not tax |
| **Netherlands** | No tax on the sale itself: box 3 taxes wealth yearly. The **Wet werkelijk rendement box 3** (passed by the Tweede Kamer on 12 Feb 2026, planned for 1 Jan 2028) taxes actual returns **including unrealised gains** on shares each year | **No tax deferral from borrowing** for stocks. Our Dutch pitch must be speed, keeping assets and collectibles, not tax |
| **Belgium** | New **10% tax on realised capital gains** on financial assets from 1 Jan 2026, with an annual exemption (around €10,000 per person) | Moderate deferral; spreading sales over years to use the exemption is a real alternative |
| **France, Spain, Italy** | Flat or banded taxes on capital gains (roughly 26–30%; Spain progressive 19–30%) | Similar to Germany |
| **US** (not our market) | 0/15/20% long-term + 3.8% NIIT; collectibles up to 28%; **step-up at death** | The classic "buy, borrow, die" case |

**Two tax traps specific to us:**
- **Moving tokens into a smart contract may itself be a disposal** in some countries (e.g. UK guidance on DeFi lending looks at whether beneficial ownership changes). Our vault keeps the user's claim, but this needs a written tax opinion per launch country before we say "no tax event".
- **Interest is usually not deductible** for private individuals on loans used for consumption (a car, a house deposit). Don't imply it is.

## 4. Big purchases: car and house

**Car.** A good fit: amounts €15–60k, short horizon, often repaid from salary within 1–2 years. Compare our APR with a normal car loan: Dutch banks advertise car/personal loans from about 7.5% (ABN AMRO) and 9.9–11.9% (ING), checked Sept 15, 2026. Our 9.9–12.9% is in that range with no fixed schedule and no sale of assets; brokers' securities loans (IBKR EUR ~3.7%, German Wertpapierkredit ~4.9–7%) are cheaper for people who have them.

**House deposit.** Works financially for short bridges (e.g. until an old home is sold), but:
- Mortgage lenders ask where the deposit comes from and count other debts; a secured loan used as the deposit can reduce how much they lend, or be refused. Tell members to check with their mortgage adviser first. In the Netherlands, lenders also check BKR registrations.
- Large SEPA payouts trigger AML checks (source of funds) at the payout provider and the receiving bank. Our app asks for a purpose above €10,000 (FR-084).
- LTV discipline matters more with big amounts: a €100k loan at 25% LTV has a lot of euros at stake if markets fall. Keep the suggested max 35% visible.

## 5. Model assumptions

`scripts/borrow_vs_sell.py`: stocks grow 7%/yr (flat and −20% stress shown); watch +5%/yr or flat; sale costs 0.25% (DE stocks), 0.35% (BE), 15% (watch); interest accrues linearly like the program; StockCard SEPA fee 0.5% added to the loan; "cashed out" = sell everything at the horizon and pay all tax, the strictest comparison. Portfolio examples: DE €150k value / €60k basis / €40k need; BE €400k / €150k / €100k; NL same as DE with no sale tax; watch €60k / €25k / €15k, must be sold whole.

## 6. What this means for StockCard

**Where our product is clearly valuable**
1. **Collectibles, watches, art.** Banks don't offer Lombard loans against a PSA 10 card or a Daytona to normal customers; the alternatives are selling (10–25% costs, months) or pawn-style loans that are typically far more expensive than 15.9% a year. This is our strongest "borrow, don't sell" story.
2. **On-chain stock holders.** xStocks/SPCX holders have no broker to lend against their tokens; we're the credit line where their assets already live.
3. **Speed and spend.** Minutes to a card or an IBAN, 24/7, no sale.

**Where we're weak**
- **Plain stock holders with a broker.** IBKR and German online brokers lend at ~3.7–7%. At 9.9–14.9% we can't claim "cheaper than paying tax" to them.

**Recommendations (decisions for Luis and Bart, nothing changed in the spec yet)**
1. **Pitch copy:** lead with "Get cash from what you own in minutes, without selling it." Use the tax point only with the caveat "Selling can trigger tax. Borrowing postpones it but costs interest." Never "tax-free" or "cheaper than tax".
2. **Add an in-app "Borrow or sell?" calculator** (same math as the script) on the Send-to-bank sheet for amounts above €10,000, showing interest vs estimated tax for the member's country. It builds trust and protects us under consumer-credit rules.
3. **Consider a "Prime" stock band** (e.g. 6.9–7.9% at ≤ 20% LTV) to make stock loans competitive and let the tax story work. The cost: savers are paid ~6%, so margin at 7.9% is thin; it would need a lower savings APY on that tranche, institutional liquidity or subscription revenue.
4. **Keep the margin in collectibles and art**, where 11.9–15.9% is competitive and the value to the member is highest.
5. **Get two professional opinions before launch:** tax (disposal on deposit into the vault; per-country treatment of tokenized stocks) and consumer credit (CCD2 scope from 20 Nov 2026).

## Sources (checked Sept 15, 2026)

- Netherlands box 3: rijksoverheid.nl "Plannen werkelijk rendement box 3"; Deloitte NL "Wetsvoorstel Wet werkelijk rendement box 3 aangenomen door Tweede Kamer"; ABN AMRO "How will changes to box 3 affect you?"
- Belgium: Loyens & Loeff "Capital gains tax in Belgium becomes reality as of 1 January 2026"; BNP Paribas Fortis "10 questions on capital gains tax"
- Germany: Finanztip / Raisin on the €1,000 Sparerpauschbetrag; extraETF "Wertpapierkredit Vergleich" (Maxblue 4.90%, S Broker 5.90%, Comdirect 6.05%, Consorsbank 7.05%)
- Interactive Brokers margin rates page: EUR 0–90,000 at 3.697% (IBKR Pro)
- Dutch car loans: ABN AMRO autofinanciering "vanaf 7,50%", ING autolening 9.9–11.9%
- EU Consumer Credit Directive 2023/2225: applies from 20 November 2026 (EUR-Lex summary; PwC Legal)
- Bridge SEPA off-ramp: apidocs.bridge.xyz EUR integration guide and "Offramp with liquidation addresses"
