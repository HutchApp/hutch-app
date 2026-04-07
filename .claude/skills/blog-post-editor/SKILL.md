---
name: blog-post-editor
description: Blog post authoring conventions. Use when creating, editing, moving, or troubleshooting blog posts. Triggers on blog content work, markdown files intended for the blog, or questions about the /blog route.
---

# Blog Post Editor

## Finding the Posts Directory

The blog discovery module scans a directory at runtime using `readdirSync` and filters for `.md` files. To find the current posts directory:

1. Grep the codebase for the file that calls `readdirSync` and filters `.md` blog files (e.g. `readdirSync.*\.md`)
2. In that file, find the variable that resolves the posts directory path (e.g. a `join(__dirname, ...)` call)
3. The resolved directory is where blog post markdown files must be placed

Do not assume a hardcoded path. Always discover it from the source code.

## Blog Post File Requirements

Each post is a single markdown file placed in the discovered posts directory.


### Frontmatter Schema

Every post must have YAML frontmatter with the fields that follow the pattern of existing posts

### Slug-Filename Invariant

The `slug` value in frontmatter **must** match the filename (minus `.md`). For example, a file named `my-post.md` must have `slug: "my-post"`. The discovery module asserts this at load time and will throw if they diverge.

## Ordering

Posts are sorted by `date` in descending order (newest first) automatically by the discovery module. No manual ordering is needed — just set the correct `date` in frontmatter.

## Testing

Do not create new tests when adding or removing blog posts. The existing tests validate the blog infrastructure (discovery, rendering, SEO) and are written to work regardless of which posts exist.

If adding or removing a post breaks any test, rewrite the broken test so it no longer couples to a specific post. Tests should derive their expectations dynamically from the loaded posts (e.g. use `getAllPosts()[0]` or `getAllSlugs()`) rather than hardcoding a slug, title, or date.

## Verification

After adding or moving a blog post:

1. Run the project's test suite to confirm the post is discovered and parsed without errors
2. Check that `getAllPosts()` returns the new post alongside existing ones
3. Confirm the post is accessible at `/blog/{slug}`
