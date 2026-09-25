// FAQ per specs/002-landing-site/brief.md §8. Answers grounded only in brief facts.

export type FaqItem = { question: string; answer: string };

export const FAQ: FaqItem[] = [
  {
    question: "What can I use as collateral?",
    answer:
      "Tokenized stocks, graded cards, luxury watches and art notes — real assets, not memecoins. We never accept memecoins or volatile crypto as collateral.",
  },
  {
    question: "Do I have to sell my assets?",
    answer:
      "No. You lock them and borrow against them. You keep ownership and get them back when you repay.",
  },
  {
    question: "What happens if prices fall?",
    answer:
      "There's a buffer between your borrowing limit and liquidation, and you get alerts (in-app and web push) before anything happens. You can add collateral or repay to stay safe. Liquidation is only a last resort.",
  },
  {
    question: "Who holds my assets?",
    answer:
      "An on-chain Solana program holds your collateral. StockCard can't move it — the rules are enforced by the program, not by us.",
  },
  {
    question: "What does it cost?",
    answer:
      "Borrowing costs 9.9%–14.9% APR depending on how much of your collateral's value you borrow — borrow less, pay less. Paid membership tiers (Plus, Black) add higher cashback and benefits; the safety rules never depend on your tier.",
  },
  {
    question: "How does Savings work and where does the yield come from?",
    answer:
      "You can earn ~6% variable APY on USDC. Your savings fund other members' credit lines, and 60% of the interest borrowers pay goes to savers. The rate is variable. Savings is in development and not available in the EU until regulatory approval.",
  },
  {
    question: "What is the founding member offer?",
    answer:
      "The first 1,000 waitlist members who activate within 90 days of launch get: a founding APR of −2 points for 12 months on their first €5,000 of balance; 3 months of Plus for every referral; +1 point APY on their first $10,000 of savings for 6 months; and the first 250 Black members get a numbered founders metal card.",
  },
  {
    question: "Can I use cards from Solflare Packs?",
    answer:
      "Cards pulled from Solflare Packs are Collector Crypt NFTs on Solana. Eligibility for them as collateral is planned.",
  },
  {
    question: "When can I get the card?",
    answer:
      "StockCard is in devnet beta now, and the waitlist is for launch. We don't promise a date. In development · Devnet beta · Not available yet.",
  },
  {
    question: "Which countries?",
    answer:
      "The EU first. Availability depends on the card issuer and regulatory approval.",
  },
  {
    question: "How does cashback work?",
    answer:
      "Every purchase earns cashback that automatically buys more of the asset you choose — like NVDAx or SPYx — and adds it straight to your collateral position.",
  },
];
