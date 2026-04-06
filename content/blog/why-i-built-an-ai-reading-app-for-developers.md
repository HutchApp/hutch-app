# Why I Built an AI Reading App for Developers

I've been reading programming articles obsessively for over 10 years.

Not casually. Not "I'll bookmark this and never look at it again." I mean a real system — one that evolved from a janky script into a full pipeline, and eventually into an app called [Hutch](https://hutch.cloud).

Let me tell you how I got here.

## The Pipeline

It started with Reddit. I was spending hours on r/programming, r/javascript, r/webdev — reading postmortems, architecture deep dives, opinions on frameworks I hadn't tried yet. Somewhere along the way I crossed 300k karma, which tells you less about the quality of my contributions and more about how much time I was spending there.

I built a pipeline. Reddit posts I wanted to read got pushed into a Gmail queue. Every morning I'd scan the subject lines, open a few tabs, and read through them with my coffee. When I found something genuinely useful, I'd save it to a folder. When I didn't have time, which was most mornings, I'd star it and promise myself I'd come back.

I almost never came back.

Later, I started pasting articles into ChatGPT and asking for summaries. That actually helped — not as a replacement for reading, but as a filter. A two-paragraph summary told me whether the full article was worth 15 minutes. My reading throughput jumped from maybe 20–30% of my queue to around 70%. Not because I read faster. Because I chose better.

That distinction matters.

## The Developer Reading Problem

Developers have a reading problem that's different from everyone else's. Our reading list isn't "interesting articles I saw on Twitter." It's professional development. It's the Stripe API migration guide. It's that postmortem from Cloudflare about the outage that took down half the internet for an hour. It's the blog post explaining why your ORM is lying to you about connection pooling.

Saving a recipe and never making it is harmless. Saving a technical article about a vulnerability in a library you use and never reading it can actually cost you.

The guilt is different too. Every unread article in the queue feels like falling behind. Like everyone else already read the thing about the new React compiler, and you're still stuck on the article from three weeks ago about database indexing strategies. The queue grows. The guilt compounds. Eventually you declare bankruptcy, archive everything, and start over.

I've done that at least four times.

## When AI Changed the Equation

When I added AI summaries to my personal reading system, something clicked. The summaries weren't replacing the reading — they were replacing the triage. Instead of opening every article and skimming the first three paragraphs to decide if it was worth my time, I could read a summary and make that decision in 30 seconds.

The articles I did read, I read properly. Start to finish. Because I'd already decided they were worth it.

My queue stopped growing for the first time in years. Not because I was saving fewer things — I was saving more, actually — but because I was processing them faster. The backlog shrank from hundreds to dozens. I stopped feeling like I was drowning.

That system, the one I'd been building and tweaking for a decade, is what became Hutch. An AI reading app for developers, built by a developer who spent 10 years trying to solve his own reading problem.

## What Hutch Actually Is

Hutch is my reading system rebuilt as an app. The AI summaries are built in from day one — not bolted on as a feature, but woven into how the whole thing works. You save an article, and by the time you open it, there's a summary waiting. You decide whether to read it now, read it later, or skip it entirely without the guilt.

I built it for developers because I am one. The browser extension is fast — save a page and close the tab in under a second. The reader view is clean, because I've spent thousands of hours reading technical content and I know what gets in the way. The AI is useful without being patronising. It doesn't try to explain your own field to you. It gives you enough to decide.

And the code is source-available. If you want to see how it works, you can read it. I spent years working on open source — I maintain [js-cookie](https://github.com/js-cookie/js-cookie), which sees over 22 billion annual hits through the jsdelivr CDN. Building in the open isn't a marketing strategy for me. It's just how I work.

## Not a Pocket Replacement

I need to be honest about something: Hutch isn't trying to be the next Pocket or Instapaper or Readwise. Those are good products. They solve the general read-it-later problem for a general audience.

Hutch solves a specific problem for a specific audience. If you're a developer who saves technical articles, API documentation, architecture blog posts, and conference talk transcripts — and you feel the weight of that unread queue — this is the tool I built for you. Because it's the tool I built for me.

The AI isn't there to summarise the internet. It's there to help you decide what deserves your attention. Your reading time is finite. Your queue is not. Something has to bridge that gap.

## Ten Years of Reading, One App

I sometimes think about what would have happened if I'd had this tool a decade ago. How many articles I saved and never read that might have changed how I approached a problem. How many postmortems I skipped that described the exact bug I'd spend three days debugging six months later.

I can't get that time back. But I can build the thing I wish I'd had.

That's Hutch. A quiet place for your reading, with just enough AI to make the queue manageable. Built by someone who's been fighting this problem for a very long time.

If that sounds like your kind of tool, [give it a try](https://hutch.cloud).
