/**
 * Bridge SEPA payouts (T081) — stub until Bridge grants EUR/SEPA access (sales@bridge.xyz)
 * and the customer has the `sepa` endorsement.
 *
 * Planned mapping (apidocs.bridge.xyz, parameters.md §3d):
 *  addBankAccount → POST /v0/customers/{id}/external_accounts  { currency: "eur", account_type: "iban", iban: {...} }
 *                   then POST /v0/customers/{id}/liquidation_addresses
 *                        { chain: "solana", currency: "usdc", destination_payment_rail: "sepa",
 *                          destination_currency: "eur", external_account_id, developer_fee_percent }
 *  quote          → same maths as the mock, but payoutAddress = that liquidation address
 *  confirm        → the payout starts by itself when USDC lands; poll the address's drains for status
 */
import type { PayoutProvider } from "./provider";

const NOT_READY = "Bank payouts through Bridge aren't enabled yet. The demo uses the simulated payout.";

export const bridgePayoutProvider: PayoutProvider = {
  name: "bridge",
  async addBankAccount() {
    throw new Error(NOT_READY);
  },
  async listBankAccounts() {
    return [];
  },
  async removeBankAccount() {
    return false;
  },
  async quote() {
    throw new Error(NOT_READY);
  },
  async confirm() {
    throw new Error(NOT_READY);
  },
  async list() {
    return [];
  },
};
