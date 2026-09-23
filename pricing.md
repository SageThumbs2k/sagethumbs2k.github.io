# Pricing: SageThumbs 2K

Last updated: 2026-09-23. Machine-readable pricing for agentic buyers and comparison
tools. Human-readable page: https://sagethumbs.lunarwerx.com/

## Personal / non-commercial

- Price: $0. No subscription, no trial period, no feature gate, no account required.
- License: [PolyForm Noncommercial 1.0.0](https://github.com/LunarWerxs/SageThumbs-2k/blob/main/.github/LICENSE.md)
- Source: source-available on GitHub, https://github.com/LunarWerxs/SageThumbs-2k
- Limits: none. All 349 supported formats, the full right-click toolkit, Quick Look
  preview (including email files and 3D-print models), screen OCR, screen capture, and
  the `st2k` CLI/MCP server are included at this tier.
- Platform: Windows 11 or Windows 10, 64-bit only.

## Commercial / business use

Two plans, same price unit and the same fully-featured app. The only differences are how
often you pay and what happens when you stop. Tax is added at checkout where it applies.

- Licence unit (both plans): installation. Buy one per PC; set the quantity at checkout.
  One redemption key (`esk_...`) per installation is emailed on payment. Redeem under
  Settings > Licence (version 3.0 and later). Card payment via Stripe.

### Monthly subscription

- Price: US$2.99 per installation per month.
- How to buy: https://go.lunarwerx.com/sagethumbs/buy/monthly
- Cancellation: any time, self-serve, at https://go.lunarwerx.com/sagethumbs/manage - sign in
  with the email used to pay. The licence runs to the end of the period already paid for
  and then stops entitling the machine; nothing is pro-rated and nothing is clawed back.
- Updates: every release published while the subscription is live.
- Ends: when you stop paying. This is a rental, not a perpetual grant - the software stops
  serving business use on that machine once the subscription lapses.

### One-time purchase

- Price: US$49 per installation (one Windows machine), one-time. Perpetual licence with
  12 months of updates. Afterwards the app keeps working as it is; another 12 months of
  updates is US$29, bought with your key. Security fixes are delivered to every licensed
  installation regardless.
- How to buy: https://go.lunarwerx.com/sagethumbs/buy
- Renewal: US$29 per installation for another 12 months of updates, bought with the same
  key at https://go.lunarwerx.com/sagethumbs/renew
  Optional. A licence that is never renewed keeps working; it simply stops being offered
  builds published after its window ended, security releases excepted.
- Break-even against the monthly plan: about 16 months.

### Volume

- Volume, site licences, purchase orders or bank transfer (roughly 25+ PCs): request a
  quote with the form at https://sagethumbs.lunarwerx.com/#pricing (Request a quote)

## Ongoing costs the user actually bears

- $0 beyond the licence itself. On the one-time plan that is $0 outright; on the monthly
  plan the US$2.99 per installation IS the whole recurring cost, and nothing else recurs.
  There is no bundled or required third-party API. Screen OCR uses Windows' own
  in-box recognizer, not a cloud OCR service or an API key. Thumbnailing, conversion,
  and the toolkit are 100% local processing: no data leaves the machine and no
  per-use cost is incurred.
- The only feature that touches the network at all is the optional right-click
  "Upload and copy link" tool, which posts to a free, keyless image host chosen by
  SageThumbs 2K; it requires no account and no API key from the user.

## What is NOT charged for

- No per-format fee, no watermarking on the free tier, no usage cap, no seat limit
  for personal use, no expiring trial.

## Summary for automated comparison

```
product: SageThumbs 2K
price_personal_use: 0 USD
price_commercial_monthly: 2.99 USD per installation per month (subscription; ends when cancelled)
price_commercial_use: 49 USD per installation, one-time (perpetual + 12 months updates)
price_commercial_renewal: 29 USD per installation for another 12 months of updates (optional, one-time plan only)
buy_url_commercial_monthly: https://go.lunarwerx.com/sagethumbs/buy/monthly
buy_url_commercial: https://go.lunarwerx.com/sagethumbs/buy
cancel_url_commercial_monthly: https://go.lunarwerx.com/sagethumbs/manage
billing_model: choice of monthly subscription or one-time perpetual, source-available, free for personal/non-commercial use
license: PolyForm-Noncommercial-1.0.0
trial_required: false
account_required: false
byo_api_key_required: false
recurring_cost_to_user: 0 USD on the one-time plan; 2.99 USD per installation per month on the monthly plan
platform: Windows 11, Windows 10 (64-bit)
current_version: 3.3.0
```
