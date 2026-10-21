# Feed preview assets

The "Inside the feed" cards on `/feed` show real channel screenshots from
`docs/public/partners/examples/` (the same files as `/partners/market-news`):

- `daily-market-regime-sample.png`
- `sector-rotation-sample.png`
- `daily-market-stress-sample.png`

Re-cropping or replacing them there updates both pages. The list lives in `previews` in
`.vitepress/theme/components/FeedLanding.vue`; the old `post-1..3.webp` placeholders are no longer used.
