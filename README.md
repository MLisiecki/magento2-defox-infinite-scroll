# Defox Infinite Scroll for Magento 2

Infinite scroll with a "Show more" button for product listings on category pages and search results.

## Features

- Loads the next page automatically as the shopper nears the end of the list, up to a configurable number of pages, then shows a **Show more** button.
- Each page is a plain GET of the pager's "Next" link, so Full Page Cache and Varnish serve it as usual.
- SEO-safe: the pager stays in the HTML for crawlers and no-JS visitors. When a visitor lands directly on `?p=N`, the pager remains visible so earlier pages are reachable.
- Keeps the browser URL in sync (`?p=N`) while preserving filters, sorting, limit and grid/list mode.
- "Showing X of N" counter with a progress bar; the toolbar amount is updated after each load.
- Skeleton placeholders and a loader while loading; `aria-busy` and an `aria-live` status message for screen readers.
- A failed request brings the button back for a manual retry.
- When disabled, the module adds nothing to the page and standard pagination works.

## Requirements

- Magento 2.4.7 – 2.4.9, PHP 8.2 – 8.5
- A Luma/Blank-based theme (default selectors)

## Installation

Copy the module to `app/code/Defox/InfiniteScroll`, or install it with Composer:

```bash
composer config repositories.defox-infinite-scroll vcs https://github.com/MLisiecki/magento2-defox-infinite-scroll
composer require defox/module-infinite-scroll
```

Then:

```bash
bin/magento module:enable Defox_InfiniteScroll
bin/magento setup:upgrade
bin/magento setup:di:compile             # production mode
bin/magento setup:static-content:deploy  # production mode
bin/magento cache:flush
```

## Configuration

**Stores > Configuration > DEFOX > Infinite Scroll** (default / website / store view):

| Field | Default | Description |
|---|---|---|
| Enabled | No | Turns infinite scroll on for category pages and search results. |
| Auto-load pages before button | 2 | How many pages load automatically while scrolling. `0` = button only. |

Flush the cache after changing the configuration (results are stored in FPC). Products per page come from the standard Magento setting (Catalog > Storefront). Button and message texts are translatable (`i18n/`).

## License

[GNU General Public License v3.0](LICENSE)
