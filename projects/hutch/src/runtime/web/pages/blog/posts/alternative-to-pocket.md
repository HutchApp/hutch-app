---
title: "An Alternative to Pocket That Won't Shut Down"
description: "After Pocket was abandoned and Omnivore shut down overnight, I built Hutch — a read-it-later app designed to last."
slug: "alternative-to-pocket"
date: "2026-04-06"
author: "Fayner Brack"
keywords: "pocket alternative, read it later, omnivore alternative"
---

I have been saving articles to read later for over ten years. In that time, I watched Pocket get acquired by Mozilla, then slowly abandoned. I watched Omnivore shut down overnight after being acquired by ElevenLabs. Both times, users lost access to their reading lists with little warning.

That pattern bothered me. A read-it-later app holds something personal — your curiosity, the things you wanted to come back to. It should not disappear because a company pivots.

## Why I built Hutch

Hutch started as my own reading system. I had been running a personal setup for years — saving links, organising them, reading on my own terms. When the tools I relied on started disappearing, I decided to turn that system into something others could use.

The goal was simple: build a read-it-later app that respects your time and your data.

## What makes Hutch different

Hutch is built by one person. There is no venture capital, no growth-at-all-costs pressure, no reason to pivot or shut down. The business model is straightforward — free for the first 100 founding members, then a small monthly fee.

Every user can export their data at any time. That is not a feature I added as an afterthought. It is a core promise: even if you cancel, your saved articles stay available for export.

## The stack

Hutch runs on deliberately boring infrastructure. Node.js, TypeScript, DynamoDB, Pulumi. After maintaining [js-cookie](https://github.com/js-cookie/js-cookie) for over ten years — a library with 22 billion annual npm downloads — I have learned that the best tech stack is the one that does not need babysitting.

The browser extension works on Firefox and Chrome. Save any page with one click, a keyboard shortcut, or a right-click menu. The web app lets you manage your reading list, read articles in a clean reader view, and get a short summary of each article.

## What comes next

I am working on personalised summaries, preference learning, Gmail integration for newsletter links, and highlights with notes. Each feature gets built when it is ready — no rushed launches, no half-finished features shipped to hit a deadline.

If you have been looking for a Pocket alternative that is not going to disappear, [give Hutch a try](https://hutch-app.com).
