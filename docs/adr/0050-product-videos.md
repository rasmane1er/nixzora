# ADR-0050: Product videos

- Status: accepted
- Date: 2026-10-26

## Context

Shoppers want to see a product in use, and stores already have videos on YouTube or Vimeo.
Hosting video ourselves means storage, transcoding, scanning (ADR-0025 covers images only) and
bandwidth: real costs, and a lot of moving parts for a small team.

## Decision

- **Links, not uploads.** A listing can have up to 3 videos, each a YouTube or Vimeo link
  (`product_videos`: provider, the provider's id, a title, a still, a position). NIXZORA
  stores and serves no video, so there is nothing to host, transcode or scan, and nothing to
  pay for.
- **One shared parser** (`parseVideoUrl`) accepts the usual link shapes (watch, youtu.be,
  shorts, embed; Vimeo pages, channels, the player, unlisted links with their key) and builds
  the player and "watch on" addresses (`videoUrls`).
- **Checked with the provider** when added (`VIDEO_LOOKUP=oembed`, the providers' free public
  oEmbed endpoints, no key): the video's own title is used when the store gives none, the still
  is kept only from the provider's image host, and private, removed or non-embeddable videos are
  refused with a clear message. If the provider can't be reached within 4 seconds the link is
  taken as given, so a slow provider never blocks a store (and an API without internet egress
  still works). YouTube stills are derived from the id.
- **Privacy:** YouTube plays from `youtube-nocookie.com`, Vimeo with `dnt=1`. On the website the
  player loads only when the shopper presses play (a still and a play button until then), so a
  product page makes no request to either provider. The storefront's CSP allows exactly those
  two players as frames.
- **Review:** a store adding a video to a live listing sends it back to review, like a new
  photo; reviewers see the videos in Listing review. Removing one needs no review. Staff can add
  and remove videos on any product in the Ops Center.
- **Clients:** a Videos section on the product page (website: inline player, on every screen
  size; app: a row of stills that opens the player in an in-app browser, so the app needs no
  native video module and OTA updates keep working). Stores add videos on the listing page in
  Seller Central.

## Consequences

- A video can disappear or turn private on the provider's side; the tile still shows and the
  player says so. A periodic re-check could hide those later.
- Only YouTube and Vimeo for now; another provider is a parser case plus a frame-src entry.
