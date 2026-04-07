---
title: "Omnivore Shut Down. Here's a Read-It-Later App That Won't."
description: "Omnivore shut down with two weeks notice. Hutch is a privacy-first read-it-later app built by a developer and no VC funding."
slug: "omnivore-alternative"
date: "2026-04-04"
author: "Fayner Brack"
keywords: "Omnivore alternative, Omnivore replacement, Omnivore shut down, read it later app, ElevenLabs Omnivore, Readwise Reader alternative"
---

On November 1, 2024, ElevenLabs acquired Omnivore. On November 15, the service shut down and data deletion began. Users had two weeks to export years of saved articles, highlights, and notes.

Two weeks. That was the entire window between "your app still works" and "your data is gone."

Omnivore was open source, community-loved, and had a clear mission. None of that mattered once the acquisition closed. The codebase went read-only. The API stopped responding. The newsletters stopped arriving.

## The problem was the business model

The problem was not Omnivore's intentions. The team built a good product. The problem was venture capital. VC-funded apps need an exit. When the exit comes, users are an afterthought.

Many Omnivore users moved to [Readwise Reader](https://readwise.io/read) at $12.99/month. Others went to self-hosted options like Karakeep or Wallabag. Each option has trade-offs. Readwise is feature-rich but expensive. Self-hosted tools are free but need you to run a server and deal with updates.

I built Hutch as a middle ground. A hosted read-it-later app with a clear revenue model: subscriptions. No investors. No exit to chase.

## Built by a developer who reads

I'm [Fayner Brack](https://www.linkedin.com/in/fagnerbrack/). I created [js-cookie](https://www.jsdelivr.com/package/npm/js-cookie), a JavaScript library with 22 billion+ downloads per year on jsDelivr. I have been building for the web for a long time.

For 10 years I maintained a personal reading pipeline. Gmail filters, DynamoDB tables, and Reddit automations helped me save, organise, and read technical articles. That system generated 300,000+ Reddit karma across developer communities.

Pocket was abandoned. Omnivore disappeared. I turned that personal system into Hutch. One developer, building in public, one feature at a time.

## What works today

These features are shipped and live right now:

- **Firefox and Chrome extensions.** Save any page with one click, a keyboard shortcut, or the right-click menu.
- **Reader view.** Clean article layout powered by Mozilla's readability engine. No clutter.
- **TL;DR summaries.** AI-generated summary per article. Key points in seconds. Included in every plan.
- **Web app.** Manage your reading list from any browser. No app store needed.
- **Auto dark mode.** Matches your system preference.
- **Secure auth.** OAuth with PKCE. Tokens stored locally in your browser.
- **Full data export.** Export everything, anytime. Even after you cancel.
- **Privacy first.** Hosted in Sydney. Australian Privacy Act. No tracking. No ads.

## What Omnivore had, and where Hutch stands

Omnivore had years of development. Hutch is newer. Here is an honest look at the gaps.

| Feature | Omnivore | Hutch | Status |
| --- | --- | --- | --- |
| Browser extension | Yes | Yes | Shipped |
| Reader view | Yes | Yes | Shipped |
| TL;DR summaries | No | Yes | Shipped |
| Dark mode | Yes | Yes | Shipped |
| Full data export | Yes | Yes | Shipped |
| Open source | Was (archived) | Yes | Shipped |
| Highlights and notes | Yes | No | Planned |
| Full-text search | Yes | No | Planned |
| Newsletter inbox | Yes | No | Planned as Gmail import |
| Labels / tags | Yes | No | Planned |
| Native mobile apps | Yes | No | Planned |
| RSS feed reader | Yes | No | Not planned yet |
| API access | Yes | OAuth only | Extension API exists but not yet for public consumption |

I would rather be honest about gaps than pretend they don't exist. Features ship one at a time, and the [roadmap is public](https://hutch-app.com/#roadmap).

## Your data, your terms

**AGPL source-available.** The full source code is [on GitHub](https://github.com/HutchApp/hutch-app). If Hutch disappears tomorrow, anyone can run it. That's the point.

**Full export, always.** Export all your data anytime, even after you cancel. No two-week countdown. No scrambling for backups.

**Australian hosting.** Hosted in Sydney. Governed by the Australian Privacy Act, outside US jurisdiction. No tracking, no ads, no data sales.

**No venture capital.** Hutch is self-funded. Revenue comes from subscriptions. There are no investors expecting an exit, no board to please, no acquisition to chase.

## Pricing

$3.99/month. TL;DR summaries are included.

Readwise Reader is a great choice for power users at $12.99/month. Hutch is simpler and cheaper. A focused read-it-later tool, not a full research platform.

The first 100 founding members get full access free, forever. [Sign up here](https://hutch-app.com/signup).

## Common questions from Omnivore users

**What happened to Omnivore?**

ElevenLabs acquired Omnivore on November 1, 2024, and shut it down on November 15. Users had about two weeks to export their data before deletion began. The open-source repository was archived. The team moved to ElevenLabs to work on text-to-speech, not reading tools. Omnivore is not coming back.

**Is there a free Omnivore alternative?**

Hutch is free for the first 100 founding members. Full access, forever. After that, it costs $3.99/month. Self-hosted alternatives like Karakeep and Wallabag are free but require you to run your own server. Readwise Reader is the most feature-complete option at $12.99/month.

**Can I import my Omnivore data into Hutch?**

You can send Omnivore data file to hutch+migrate@hutch-app.com and I'll do it for you. If you exported your data before the shutdown, keep that file. You can start fresh right now with the [browser extension](https://hutch-app.com/install). Save any article with one click.

## Your reading list should not have an expiry date

Install the extension. Save an article. See if it fits how you read.

[Install the browser extension](https://hutch-app.com/install) or [view the source on GitHub](https://github.com/HutchApp/hutch-app).
