use crate::errors::StockcardError;
use crate::state::RateBand;
use anchor_lang::prelude::*;

pub const BPS: u128 = 10_000;
pub const SECONDS_PER_YEAR: u128 = 31_536_000;
pub const MULTIPLIER_SCALE: u128 = 1_000_000;

fn ceil_div(n: u128, d: u128) -> Result<u64> {
    if d == 0 {
        return err!(StockcardError::MathOverflow);
    }
    if n == 0 {
        return Ok(0);
    }
    let q = (n - 1) / d + 1;
    u64::try_from(q).map_err(|_| error!(StockcardError::MathOverflow))
}

fn floor_div(n: u128, d: u128) -> Result<u64> {
    if d == 0 {
        return err!(StockcardError::MathOverflow);
    }
    u64::try_from(n / d).map_err(|_| error!(StockcardError::MathOverflow))
}

fn pow10(n: u32) -> Result<u128> {
    if n > 18 {
        return err!(StockcardError::MathOverflow);
    }
    Ok(10u128.pow(n))
}

// interest = ceil(debt * apr_bps * elapsed / (10_000 * 31_536_000)), rounded up.
pub fn accrue_interest(debt: u64, apr_bps: u16, elapsed_secs: u64) -> Result<u64> {
    let n = (debt as u128) * (apr_bps as u128) * (elapsed_secs as u128);
    ceil_div(n, BPS * SECONDS_PER_YEAR)
}

// protocol share of interest, rounded up (protocol's favor).
pub fn reserve_share(interest: u64, protocol_share_bps: u16) -> Result<u64> {
    ceil_div((interest as u128) * (protocol_share_bps as u128), BPS)
}

// First band whose max_ltv_bps covers the LTV; unused bands are {0, 0}.
pub fn select_apr_bps(bands: &[RateBand; 3], ltv_bps: u64) -> u16 {
    let mut selected: u16 = 0;
    for band in bands.iter() {
        if band.max_ltv_bps == 0 || band.apr_bps == 0 {
            continue;
        }
        selected = band.apr_bps;
        if ltv_bps <= band.max_ltv_bps as u64 {
            return band.apr_bps;
        }
    }
    selected
}

pub fn price_to_usd6(price: i64, expo: i32) -> Result<u64> {
    if price <= 0 {
        return err!(StockcardError::InvalidPrice);
    }
    let p = price as u128;
    let shift = expo + 6;
    let usd6 = if shift >= 0 {
        p.checked_mul(pow10(shift as u32)?)
            .ok_or(error!(StockcardError::MathOverflow))?
    } else {
        p / pow10((-shift) as u32)?
    };
    u64::try_from(usd6).map_err(|_| error!(StockcardError::MathOverflow))
}

// value_usd6 = floor(raw * multiplier * price_usd6 * (10_000 - haircut) / (10^decimals * 1e6 * 10_000))
pub fn collateral_value_usd6(
    amount: u64,
    multiplier_micro: u64,
    price_usd6: u64,
    haircut_bps: u16,
    decimals: u8,
) -> Result<u64> {
    if haircut_bps >= 10_000 {
        return err!(StockcardError::InvalidRiskParams);
    }
    let n = (amount as u128)
        .checked_mul(multiplier_micro as u128)
        .and_then(|v| v.checked_mul(price_usd6 as u128))
        .and_then(|v| v.checked_mul(BPS - haircut_bps as u128))
        .ok_or(error!(StockcardError::MathOverflow))?;
    let d = pow10(decimals as u32)? * MULTIPLIER_SCALE * BPS;
    floor_div(n, d)
}

// LTV in bps, rounded up. No collateral + debt => u64::MAX.
pub fn ltv_bps(debt: u64, value_usd6: u64) -> Result<u64> {
    if value_usd6 == 0 {
        return Ok(if debt > 0 { u64::MAX } else { 0 });
    }
    let v = ceil_div((debt as u128) * BPS, value_usd6 as u128)?;
    Ok(if debt > 0 && v == u64::MAX { u64::MAX } else { v })
}

// seize_raw = floor(repay * (10_000 + bonus) * 10^decimals * 1e6 / (10_000 * price_usd6 * multiplier))
pub fn seize_amount(
    repay_usd6: u64,
    liq_bonus_bps: u16,
    price_usd6: u64,
    multiplier_micro: u64,
    decimals: u8,
) -> Result<u64> {
    if price_usd6 == 0 || multiplier_micro == 0 {
        return err!(StockcardError::InvalidPrice);
    }
    let scale = pow10(decimals as u32)?;
    let n = (repay_usd6 as u128)
        .checked_mul(BPS + liq_bonus_bps as u128)
        .and_then(|v| v.checked_mul(scale))
        .and_then(|v| v.checked_mul(MULTIPLIER_SCALE))
        .ok_or(error!(StockcardError::MathOverflow))?;
    let d = BPS * (price_usd6 as u128) * (multiplier_micro as u128);
    floor_div(n, d)
}

pub fn shares_for_deposit(amount: u64, total_shares: u64, pool_value: u64) -> Result<u64> {
    if total_shares == 0 {
        return Ok(amount);
    }
    if pool_value == 0 {
        return err!(StockcardError::MathOverflow);
    }
    floor_div((amount as u128) * (total_shares as u128), pool_value as u128)
}

pub fn amount_for_shares(shares: u64, total_shares: u64, pool_value: u64) -> Result<u64> {
    if total_shares == 0 {
        return Ok(0);
    }
    floor_div((shares as u128) * (pool_value as u128), total_shares as u128)
}

pub fn utilization_bps(total_borrowed: u64, pool_value: u64) -> Result<u64> {
    if pool_value == 0 {
        return Ok(if total_borrowed > 0 { u64::MAX } else { 0 });
    }
    let v = ceil_div((total_borrowed as u128) * BPS, pool_value as u128)?;
    Ok(v)
}

pub fn pool_value(vault_balance: u64, total_borrowed: u64, reserve: u64) -> Result<u64> {
    let v = (vault_balance as u128)
        .checked_add(total_borrowed as u128)
        .and_then(|x| x.checked_sub(reserve as u128))
        .ok_or(error!(StockcardError::MathOverflow))?;
    u64::try_from(v).map_err(|_| error!(StockcardError::MathOverflow))
}

#[cfg(test)]
mod tests {
    use super::*;

    const MICRO: u64 = 1_000_000;

    #[test]
    fn accrue_rounds_up() {
        // $500 at 12.9% for one day = 500e6 * 1290 * 86400 / (1e4 * 31536000)
        let i = accrue_interest(500_000_000, 1290, 86_400).unwrap();
        // exact: 176712.328... -> 176713
        assert_eq!(i, 176_713);
        assert_eq!(accrue_interest(0, 1290, 86_400).unwrap(), 0);
    }

    #[test]
    fn accrue_matches_spec_examples() {
        // $500 on 10 NVDAx -> 12.9% -> $0.18/day
        assert_eq!(accrue_interest(500_000_000, 1290, 86_400).unwrap(), 176_713);
        // $1,000 at 47.2% -> 14.9% -> $0.41/day
        assert_eq!(accrue_interest(1_000_000_000, 1490, 86_400).unwrap(), 408_220);
        // $3,500 on $10,000 at 35% -> 12.9% -> $1.24/day
        assert_eq!(accrue_interest(3_500_000_000u64, 1290, 86_400).unwrap(), 1_236_987);
    }

    #[test]
    fn reserve_share_rounds_up() {
        assert_eq!(reserve_share(101, 4000).unwrap(), 41); // 40.4 -> 41
        assert_eq!(reserve_share(0, 4000).unwrap(), 0);
    }

    #[test]
    fn apr_band_selection() {
        let bands = [
            RateBand { max_ltv_bps: 2000, apr_bps: 990 },
            RateBand { max_ltv_bps: 3500, apr_bps: 1290 },
            RateBand { max_ltv_bps: 5000, apr_bps: 1490 },
        ];
        assert_eq!(select_apr_bps(&bands, 0), 990);
        assert_eq!(select_apr_bps(&bands, 2000), 990);
        assert_eq!(select_apr_bps(&bands, 2001), 1290);
        assert_eq!(select_apr_bps(&bands, 3500), 1290);
        assert_eq!(select_apr_bps(&bands, 3501), 1490);
        assert_eq!(select_apr_bps(&bands, 5000), 1490);
        let two_bands = [
            RateBand { max_ltv_bps: 2000, apr_bps: 1190 },
            RateBand { max_ltv_bps: 4000, apr_bps: 1590 },
            RateBand::default(),
        ];
        assert_eq!(select_apr_bps(&two_bands, 1500), 1190);
        assert_eq!(select_apr_bps(&two_bands, 4000), 1590);
    }

    #[test]
    fn collateral_value_10_nvdax() {
        // 10 NVDAx (8 dp) at $211.96, no haircut, multiplier 1 -> $2,119.60
        let raw: u64 = 1_000_000_000;
        let v = collateral_value_usd6(raw, MICRO, 211_960_000, 0, 8).unwrap();
        assert_eq!(v, 2_119_600_000);
    }

    #[test]
    fn collateral_value_with_multiplier_and_haircut() {
        // 10 NVDAx at 211.96, multiplier 1.001701 -> $2,123.2056...
        let v = collateral_value_usd6(1_000_000_000, 1_001_701, 211_960_000, 0, 8).unwrap();
        assert_eq!(v, 2_123_205_439);
        // 1,000 TIDE (6 dp) at $10, haircut 20% -> $8,000
        let v = collateral_value_usd6(1_000_000_000, MICRO, 10_000_000, 2000, 6).unwrap();
        assert_eq!(v, 8_000_000_000);
    }

    #[test]
    fn ltv_demo_numbers() {
        // $1,000 on $2,119.60 -> 47.18%
        let l = ltv_bps(1_000_000_000, 2_119_600_000).unwrap();
        assert_eq!(l, 4718);
        // post-crash: price 148.372 -> value 1,483.72 -> 67.4%
        let l = ltv_bps(1_000_000_000, 1_483_720_000).unwrap();
        assert_eq!(l, 6740);
        assert_eq!(ltv_bps(0, 0).unwrap(), 0);
        assert_eq!(ltv_bps(1, 0).unwrap(), u64::MAX);
    }

    #[test]
    fn seize_demo_numbers() {
        // liquidate $500 at price $148.372, bonus 5%, multiplier 1, 8 dp
        // -> 500 * 1.05 / 148.372 = 3.5384... NVDAx
        let s = seize_amount(500_000_000, 500, 148_372_000, MICRO, 8).unwrap();
        assert_eq!(s, 353_840_347); // 3.53840347 NVDAx, floored
    }

    #[test]
    fn savings_share_math() {
        // empty pool: 1:1
        assert_eq!(shares_for_deposit(10_000_000_000, 0, 0).unwrap(), 10_000_000_000);
        // pool 10k shares, value 11k -> deposit 1,100 -> 1,000 shares
        assert_eq!(shares_for_deposit(1_100_000_000, 10_000_000_000, 11_000_000_000).unwrap(), 1_000_000_000);
        // 1,000 shares of 10k total at pool value 11k -> 1,100
        assert_eq!(amount_for_shares(1_000_000_000, 10_000_000_000, 11_000_000_000).unwrap(), 1_100_000_000);
    }

    #[test]
    fn utilization() {
        assert_eq!(utilization_bps(0, 0).unwrap(), 0);
        assert_eq!(utilization_bps(9_000_000_000, 10_000_000_000).unwrap(), 9000);
        assert_eq!(utilization_bps(1, 0).unwrap(), u64::MAX);
    }

    #[test]
    fn price_normalization() {
        assert_eq!(price_to_usd6(211_960_000, -6).unwrap(), 211_960_000);
        assert_eq!(price_to_usd6(21196, -2).unwrap(), 211_960_000);
        assert_eq!(price_to_usd6(2_119_600_000_000, -10).unwrap(), 211_960_000);
        assert!(price_to_usd6(0, -6).is_err());
        assert!(price_to_usd6(-5, -6).is_err());
    }
}
