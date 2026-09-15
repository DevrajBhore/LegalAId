# Economic allocation — what the repository establishes

Fields whose label or description claims to distribute a quantity: **8**

| field | type | collected on | label |
|---|---|---|---|
| `dissolution_terms` | textarea | 1 | Dissolution Terms |
| `dividend_policy` | textarea | 1 | Dividend Policy |
| `founder_equity_split` | textarea | 1 | Equity Split |
| `options_granted` | number | 1 | Number of Options Granted |
| `profit_sharing_ratio` | text | 2 | Profit / Loss Sharing Ratio (e.g. 50:50) |
| `shareholding_percentage_1` | number | 1 | Shareholder 1 Shareholding (%) |
| `shareholding_percentage_2` | number | 1 | Shareholder 2 Shareholding (%) |
| `voting_rights` | textarea | 1 | Voting Rights |

## Is the allocation attributable to a party?

| field | schema index | label names a party | verdict |
|---|---|---|---|
| `dissolution_terms` | no | **no** | **NOTHING** |
| `dividend_policy` | no | **no** | **NOTHING** |
| `founder_equity_split` | no | **no** | **NOTHING** |
| `options_granted` | no | **no** | **NOTHING** |
| `profit_sharing_ratio` | no | **no** | **NOTHING** |
| `shareholding_percentage_1` | yes | yes | SCHEMA_INDEX |
| `shareholding_percentage_2` | yes | yes | SCHEMA_INDEX |
| `voting_rights` | no | **no** | **NOTHING** |

## The same deed carries one of each

- `capital_contribution_1` — label: "Partner 1 Capital Contribution (₹)"
- `profit_sharing_ratio`  — label: "Profit / Loss Sharing Ratio (e.g. 50:50)"

The first names the partner it belongs to, in the field name AND in the label.
The second names nobody, and every example it offers has exactly two elements.

## What a three-partner deed actually says

```
Each Partner shall contribute capital to the partnership in the following amounts: Partner 1 shall contribute ₹6,00,000 (Rupees Six Lakh Only) and Partner 2 shall contribute ₹3,00,000 (Rupees Three Lakh Only).
The capital contributions shall be held in the name of the partnership, namely Bandra Associates, carrying on business from 1 First Road, Mumbai, Maharashtra 400001, and shall not be withdrawn except in accordance with this Deed.
Profits and losses of the partnership shall be shared among the Partners in the ratio of 40:40:20, and each Partner acknowledges that the capital contribution constitutes lawful consideration for this Agreement within the meaning of Section 2(d) of the Indian Contract Act, 1872.
```

| question | answer |
|---|---|
| generation blocked | no |
| roster count | 3 |
| the ratio string reaches the deed | yes |
| any share attributed to any person | **NO** |
| third partner's capital contribution stated | **NO** |
| third partner named anywhere in the clause | **NO** |

## Counterfactuals: does anything check the allocation against the roster?

| parties | ratio | blocked | notice | ratio on the page |
|---|---|---|---|---|
| 3 | `40:40:20` | no | **none** | verbatim |
| 3 | `40:40` | no | **none** | verbatim |
| 3 | `40:40:30` | no | **none** | verbatim |
| 3 | `1/3, 1/3, 1/3` | no | **none** | verbatim |
| 3 | `equally` | no | **none** | verbatim |
| 2 | `40:40:20` | no | **none** | verbatim |
| 3 | `(blank)` | INVALID_INPUT_1 | **none** | fallback |

## Reading

An economic allocation is currently a STRING THE DOCUMENT REPEATS. Nothing
parses it, nothing counts its parts, nothing compares it to the roster, and
nothing in the repository says which part belongs to which partner.

That makes the three-partner deed AMBIGUOUS rather than wrong — and the
repair must not make it confidently wrong instead. `capital_contribution_1`
shows what an addressable allocation looks like: the ordinal is in the field
name and the party is in the label. `profit_sharing_ratio` has neither, and
no amount of arithmetic on '40:40:20' can supply what was never established.
