/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/stockcard.json`.
 */
export type Stockcard = {
  "address": "HsXyxfSvp7mha6bxgh3Qr9NoVmMVe6HmynVguRfBLWrY",
  "metadata": {
    "name": "stockcard",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "StockCard: stock-backed credit line on Solana (devnet MVP)"
  },
  "instructions": [
    {
      "name": "addMarket",
      "discriminator": [
        41,
        137,
        185,
        126,
        69,
        139,
        254,
        55
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config"
        },
        {
          "name": "collateralMint"
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "collateralMint"
              }
            ]
          }
        },
        {
          "name": "collateralVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  108,
                  108,
                  97,
                  116,
                  101,
                  114,
                  97,
                  108,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "assetClass",
          "type": {
            "defined": {
              "name": "assetClass"
            }
          }
        },
        {
          "name": "oracleKind",
          "type": {
            "defined": {
              "name": "oracleKind"
            }
          }
        },
        {
          "name": "oracleFeed",
          "type": "pubkey"
        },
        {
          "name": "maxLtvBps",
          "type": "u16"
        },
        {
          "name": "liqThresholdBps",
          "type": "u16"
        },
        {
          "name": "liqBonusBps",
          "type": "u16"
        },
        {
          "name": "haircutBps",
          "type": "u16"
        },
        {
          "name": "aprBands",
          "type": {
            "array": [
              {
                "defined": {
                  "name": "rateBand"
                }
              },
              3
            ]
          }
        },
        {
          "name": "maxPriceAgeSecs",
          "type": "u32"
        },
        {
          "name": "closedMarketAgeSecs",
          "type": "u32"
        },
        {
          "name": "closedHaircutBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "borrow",
      "discriminator": [
        228,
        253,
        131,
        202,
        207,
        116,
        89,
        18
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true
        },
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "position",
          "writable": true
        },
        {
          "name": "collateralMint"
        },
        {
          "name": "usdcVault",
          "writable": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "destinationUsdc",
          "writable": true
        },
        {
          "name": "signedPrice",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  105,
                  99,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "collateralVault",
          "writable": true
        },
        {
          "name": "usdcTokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "claimReserve",
      "discriminator": [
        227,
        111,
        249,
        83,
        44,
        122,
        200,
        10
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true
        },
        {
          "name": "usdcVault",
          "writable": true
        },
        {
          "name": "adminUsdc",
          "writable": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "usdcTokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "depositCollateral",
      "discriminator": [
        156,
        131,
        142,
        116,
        146,
        247,
        162,
        120
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true
        },
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "position",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "collateralMint"
        },
        {
          "name": "ownerToken",
          "writable": true
        },
        {
          "name": "collateralVault",
          "writable": true
        },
        {
          "name": "signedPrice",
          "optional": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  105,
                  99,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "depositCollateralFor",
      "discriminator": [
        24,
        234,
        133,
        173,
        81,
        223,
        83,
        76
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true
        },
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "position",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "arg",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "collateralMint"
        },
        {
          "name": "sourceToken",
          "writable": true
        },
        {
          "name": "collateralVault",
          "writable": true
        },
        {
          "name": "signedPrice",
          "optional": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  105,
                  99,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "owner",
          "type": "pubkey"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "depositSavings",
      "discriminator": [
        196,
        95,
        215,
        129,
        181,
        244,
        186,
        167
      ],
      "accounts": [
        {
          "name": "saver",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true
        },
        {
          "name": "usdcVault",
          "writable": true
        },
        {
          "name": "saverUsdc",
          "writable": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "savingsPosition",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  118,
                  105,
                  110,
                  103,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "saver"
              }
            ]
          }
        },
        {
          "name": "usdcTokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initConfig",
      "discriminator": [
        23,
        235,
        115,
        232,
        168,
        96,
        1,
        231
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "usdcVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  100,
                  99,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "protocolShareBps",
          "type": "u16"
        },
        {
          "name": "maxUtilizationBps",
          "type": "u16"
        },
        {
          "name": "closeFactorBps",
          "type": "u16"
        },
        {
          "name": "cashbackAuthority",
          "type": "pubkey"
        },
        {
          "name": "priceSigner",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "liquidate",
      "discriminator": [
        223,
        179,
        226,
        125,
        48,
        46,
        39,
        74
      ],
      "accounts": [
        {
          "name": "liquidator",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true
        },
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "position",
          "writable": true
        },
        {
          "name": "collateralMint"
        },
        {
          "name": "liquidatorUsdc",
          "writable": true
        },
        {
          "name": "usdcVault",
          "writable": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "liquidatorCollateral",
          "writable": true
        },
        {
          "name": "collateralVault",
          "writable": true
        },
        {
          "name": "signedPrice",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  105,
                  99,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "collateralTokenProgram"
        },
        {
          "name": "usdcTokenProgram"
        }
      ],
      "args": [
        {
          "name": "repayAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "repay",
      "discriminator": [
        234,
        103,
        67,
        82,
        208,
        234,
        219,
        166
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true
        },
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "position",
          "writable": true
        },
        {
          "name": "collateralMint"
        },
        {
          "name": "payerUsdc",
          "writable": true
        },
        {
          "name": "usdcVault",
          "writable": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "signedPrice",
          "optional": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  105,
                  99,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "usdcTokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "setPause",
      "discriminator": [
        63,
        32,
        154,
        2,
        56,
        103,
        79,
        45
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true
        },
        {
          "name": "config",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "paused",
          "type": "bool"
        }
      ]
    },
    {
      "name": "setSignedPrice",
      "discriminator": [
        238,
        36,
        23,
        166,
        57,
        231,
        242,
        234
      ],
      "accounts": [
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config"
        },
        {
          "name": "market"
        },
        {
          "name": "signedPrice",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  105,
                  99,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "price",
          "type": "i64"
        },
        {
          "name": "expo",
          "type": "i32"
        },
        {
          "name": "source",
          "type": {
            "defined": {
              "name": "priceSource"
            }
          }
        }
      ]
    },
    {
      "name": "updateMarket",
      "discriminator": [
        153,
        39,
        2,
        197,
        179,
        50,
        199,
        217
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true
        },
        {
          "name": "config"
        },
        {
          "name": "market",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "maxLtvBps",
          "type": "u16"
        },
        {
          "name": "liqThresholdBps",
          "type": "u16"
        },
        {
          "name": "liqBonusBps",
          "type": "u16"
        },
        {
          "name": "haircutBps",
          "type": "u16"
        },
        {
          "name": "aprBands",
          "type": {
            "array": [
              {
                "defined": {
                  "name": "rateBand"
                }
              },
              3
            ]
          }
        },
        {
          "name": "maxPriceAgeSecs",
          "type": "u32"
        },
        {
          "name": "closedMarketAgeSecs",
          "type": "u32"
        },
        {
          "name": "closedHaircutBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "withdrawCollateral",
      "discriminator": [
        115,
        135,
        168,
        106,
        139,
        214,
        138,
        150
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true
        },
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "position",
          "writable": true
        },
        {
          "name": "collateralMint"
        },
        {
          "name": "ownerToken",
          "writable": true
        },
        {
          "name": "collateralVault",
          "writable": true
        },
        {
          "name": "signedPrice",
          "optional": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  105,
                  99,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawSavings",
      "discriminator": [
        13,
        57,
        199,
        136,
        137,
        67,
        121,
        140
      ],
      "accounts": [
        {
          "name": "saver",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true
        },
        {
          "name": "usdcVault",
          "writable": true
        },
        {
          "name": "saverUsdc",
          "writable": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "savingsPosition",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  118,
                  105,
                  110,
                  103,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "saver"
              }
            ]
          }
        },
        {
          "name": "usdcTokenProgram"
        }
      ],
      "args": [
        {
          "name": "shares",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "market",
      "discriminator": [
        219,
        190,
        213,
        55,
        0,
        227,
        198,
        154
      ]
    },
    {
      "name": "position",
      "discriminator": [
        170,
        188,
        143,
        228,
        122,
        64,
        247,
        208
      ]
    },
    {
      "name": "savingsPosition",
      "discriminator": [
        47,
        213,
        82,
        192,
        91,
        238,
        66,
        100
      ]
    },
    {
      "name": "signedPrice",
      "discriminator": [
        91,
        171,
        72,
        236,
        40,
        57,
        35,
        188
      ]
    }
  ],
  "events": [
    {
      "name": "borrowed",
      "discriminator": [
        225,
        182,
        241,
        78,
        34,
        145,
        253,
        230
      ]
    },
    {
      "name": "cashbackDeposited",
      "discriminator": [
        235,
        208,
        14,
        18,
        30,
        155,
        14,
        155
      ]
    },
    {
      "name": "deposited",
      "discriminator": [
        111,
        141,
        26,
        45,
        161,
        35,
        100,
        57
      ]
    },
    {
      "name": "liquidated",
      "discriminator": [
        231,
        57,
        55,
        75,
        0,
        170,
        246,
        68
      ]
    },
    {
      "name": "priceSet",
      "discriminator": [
        152,
        186,
        196,
        72,
        117,
        210,
        36,
        160
      ]
    },
    {
      "name": "repaid",
      "discriminator": [
        38,
        248,
        231,
        7,
        150,
        164,
        172,
        23
      ]
    },
    {
      "name": "withdrawn",
      "discriminator": [
        20,
        89,
        223,
        198,
        194,
        124,
        219,
        13
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "This wallet isn't allowed to do that."
    },
    {
      "code": 6001,
      "name": "paused",
      "msg": "Borrowing is paused. Repayments still work."
    },
    {
      "code": 6002,
      "name": "stalePrice",
      "msg": "Price is stale."
    },
    {
      "code": 6003,
      "name": "invalidPrice",
      "msg": "Price must be positive."
    },
    {
      "code": 6004,
      "name": "exceedsMaxLtv",
      "msg": "That's more than your credit line."
    },
    {
      "code": 6005,
      "name": "notLiquidatable",
      "msg": "This position is healthy."
    },
    {
      "code": 6006,
      "name": "exceedsCloseFactor",
      "msg": "Repay amount exceeds the close factor."
    },
    {
      "code": 6007,
      "name": "insufficientLiquidity",
      "msg": "The pool can't lend that much right now."
    },
    {
      "code": 6008,
      "name": "poolUtilizationCap",
      "msg": "Borrowing is full right now."
    },
    {
      "code": 6009,
      "name": "insufficientCollateral",
      "msg": "Not enough collateral or shares."
    },
    {
      "code": 6010,
      "name": "invalidRiskParams",
      "msg": "Invalid risk parameters."
    },
    {
      "code": 6011,
      "name": "mathOverflow",
      "msg": "Math overflow."
    },
    {
      "code": 6012,
      "name": "zeroAmount",
      "msg": "Amount must be greater than zero."
    },
    {
      "code": 6013,
      "name": "wrongOracle",
      "msg": "Wrong oracle account for this market."
    },
    {
      "code": 6014,
      "name": "marketBlocked",
      "msg": "Market blocked by issuer controls or impaired vault."
    }
  ],
  "types": [
    {
      "name": "assetClass",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "equity"
          },
          {
            "name": "artNote"
          },
          {
            "name": "collectible"
          }
        ]
      }
    },
    {
      "name": "borrowed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "cashbackDeposited",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "config",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "usdcMint",
            "type": "pubkey"
          },
          {
            "name": "usdcVault",
            "type": "pubkey"
          },
          {
            "name": "protocolShareBps",
            "type": "u16"
          },
          {
            "name": "maxUtilizationBps",
            "type": "u16"
          },
          {
            "name": "totalBorrowed",
            "type": "u64"
          },
          {
            "name": "totalShares",
            "type": "u64"
          },
          {
            "name": "reserve",
            "type": "u64"
          },
          {
            "name": "closeFactorBps",
            "type": "u16"
          },
          {
            "name": "cashbackAuthority",
            "type": "pubkey"
          },
          {
            "name": "priceSigner",
            "type": "pubkey"
          },
          {
            "name": "paused",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "deposited",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "liquidated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "liquidator",
            "type": "pubkey"
          },
          {
            "name": "repayAmount",
            "type": "u64"
          },
          {
            "name": "seized",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "market",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "collateralMint",
            "type": "pubkey"
          },
          {
            "name": "collateralVault",
            "type": "pubkey"
          },
          {
            "name": "assetClass",
            "type": {
              "defined": {
                "name": "assetClass"
              }
            }
          },
          {
            "name": "oracleKind",
            "type": {
              "defined": {
                "name": "oracleKind"
              }
            }
          },
          {
            "name": "oracleFeed",
            "type": "pubkey"
          },
          {
            "name": "maxLtvBps",
            "type": "u16"
          },
          {
            "name": "liqThresholdBps",
            "type": "u16"
          },
          {
            "name": "liqBonusBps",
            "type": "u16"
          },
          {
            "name": "haircutBps",
            "type": "u16"
          },
          {
            "name": "aprBands",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "rateBand"
                  }
                },
                3
              ]
            }
          },
          {
            "name": "maxPriceAgeSecs",
            "type": "u32"
          },
          {
            "name": "closedMarketAgeSecs",
            "type": "u32"
          },
          {
            "name": "closedHaircutBps",
            "type": "u16"
          },
          {
            "name": "totalCollateral",
            "type": "u64"
          },
          {
            "name": "decimals",
            "type": "u8"
          },
          {
            "name": "hasPermanentDelegate",
            "type": "bool"
          },
          {
            "name": "hasTransferHook",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "oracleKind",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "signed"
          },
          {
            "name": "switchboard"
          }
        ]
      }
    },
    {
      "name": "position",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "collateralAmount",
            "type": "u64"
          },
          {
            "name": "debtPrincipal",
            "type": "u64"
          },
          {
            "name": "lastAccrualTs",
            "type": "i64"
          },
          {
            "name": "aprBps",
            "type": "u16"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "priceSet",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "price",
            "type": "i64"
          },
          {
            "name": "expo",
            "type": "i32"
          },
          {
            "name": "source",
            "type": {
              "defined": {
                "name": "priceSource"
              }
            }
          }
        ]
      }
    },
    {
      "name": "priceSource",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "market"
          },
          {
            "name": "appraisal"
          },
          {
            "name": "partnerFmv"
          },
          {
            "name": "demo"
          }
        ]
      }
    },
    {
      "name": "rateBand",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "maxLtvBps",
            "type": "u16"
          },
          {
            "name": "aprBps",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "repaid",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "savingsPosition",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "shares",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "signedPrice",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "price",
            "type": "i64"
          },
          {
            "name": "expo",
            "type": "i32"
          },
          {
            "name": "publishTime",
            "type": "i64"
          },
          {
            "name": "source",
            "type": {
              "defined": {
                "name": "priceSource"
              }
            }
          }
        ]
      }
    },
    {
      "name": "withdrawn",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    }
  ]
};
