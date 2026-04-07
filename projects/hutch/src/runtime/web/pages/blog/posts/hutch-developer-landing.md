---
title: "A Reading App Built by a Developer Who Reads"
description: "I spent 10 years building a personal reading pipeline with Gmail filters, DynamoDB, and Reddit automations. Hutch is that system turned into a product."
slug: "hutch-developer-landing"
date: "2026-04-07"
author: "Fagner Brack"
keywords: "developer reading list, save articles, technical reading, read it later, AGPL, open source, js-cookie, privacy first"
---

I save different things than most people. Blog posts about distributed systems. GitHub READMEs I want to revisit. Stack Overflow answers that solved a real problem. RFC documents. Conference talk transcripts. Hacker News threads where the best insight is buried 47 comments deep.

For 10 years, I ran a personal system to manage all of this. Gmail filters caught newsletter links. DynamoDB tables stored metadata. Reddit automations fed curated links into r/programming and r/webdev. That pipeline generated over 300,000 karma across technical communities. It worked, but it was held together with scripts and cron jobs.

Hutch is that system turned into a product.

## Save anything technical

The browser extension saves any page with one click. Ctrl/Cmd+D or right-click. The page content is extracted and added to your reading queue. No copy-pasting URLs into a separate app.

It works on blog posts, documentation pages, GitHub READMEs, Hacker News threads, and anything else with text content. Firefox and Chrome are both supported.

## AI summaries for triage

You saved 30 articles this week. You have time to read maybe 5. Each article gets a TL;DR summary so you can scan your queue and decide what deserves a deep read. The rest can wait or be discarded.

Powered by DeepSeek. Summaries generate automatically when you save an article. This is included in the price. It is not gated behind a higher tier.

## Reader view

Clean reading without cookie consent banners, newsletter popups, sticky nav bars, and sidebar ads. Just the article content with readable typography.

Dark mode follows your system preference. The reader is built on Mozilla's Readability engine, the same one behind Firefox Reader View. Good for late-night reading sessions when you finally get around to that post about Raft consensus you saved three weeks ago.

## Built in the open

**AGPL source-available.** The full codebase is on [GitHub](https://github.com/HutchApp/hutch-app). You can read every line of code that handles your data.

**Australian Privacy Act.** Hosted in Sydney. Your data is not subject to US jurisdiction or the CLOUD Act.

**Full data export.** JSON export of everything, anytime. No lock-in. If you leave, your data leaves with you.

**No VC funding.** No growth targets. No pivot pressure. No acqui-hire that shuts down the product two years later. I built this to last, not to fundraise.

## From the creator of js-cookie

I am [Fagner Brack](https://www.linkedin.com/in/fagnerbrack/). I created and maintain [js-cookie](https://www.jsdelivr.com/package/npm/js-cookie), a JavaScript cookie library with over 22 billion annual CDN hits on jsDelivr. It runs on millions of websites. I have been maintaining open-source software for over 10 years.

Hutch is not a weekend hackathon project. It comes from a decade of thinking about how developers read, and a track record of shipping software that other developers depend on.

## Pricing

The first 100 founding members get full access free, forever. TL;DR summaries included. After that, A$3.99/month. No free tier with ads. No premium upsell.

If you have been looking for a reading app that respects your time and your data, [give Hutch a try](https://hutch-app.com/signup).
