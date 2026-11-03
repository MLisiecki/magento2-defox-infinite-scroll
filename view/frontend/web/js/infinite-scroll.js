/**
 * @package     Defox_InfiniteScroll
 * @author      Marcin Lisiecki
 * @copyright   Copyright (c) 2026 deFox
 * @license     GNU General Public License v3.0
 *
 * Infinite scroll for product listings. Loads the next page as plain, FPC-cacheable HTML
 * (the URL of the pager "next" link), appends its items and lets mage/apply initialize
 * the widgets of the new items. Options: see view/frontend/layout/defox_infinite_scroll.xml
 * and ViewModel/Config.php.
 */
define([
    'jquery',
    'mage/mage' // registers the 'contentUpdated' -> mage.apply() handler (lib/web/mage/mage.js)
], function ($) {
    'use strict';

    var B = 'defox-infinite-scroll';

    /**
     * @param {String} tag
     * @param {String} className
     * @param {String} [text]
     * @return {HTMLElement}
     */
    function el(tag, className, text) {
        var node = document.createElement(tag);

        node.className = className;

        if (text) {
            node.textContent = text;
        }

        return node;
    }

    /**
     * Locale-formatted number ("1 250", "1.250") -> 1250.
     *
     * @param {Element} node
     * @return {Number}
     */
    function num(node) {
        return parseInt(node.textContent.replace(/\D/g, ''), 10) || 0;
    }

    return function (config) {
        var s = config.selectors,
            labels = config.labels,
            list = document.querySelector(s.container),
            nextLink = document.querySelector(s.nextLink),
            nextUrl = nextLink ? nextLink.href : null,
            startPage = parseInt(new URL(window.location.href).searchParams.get(config.pageParam), 10) || 1,
            amount = document.querySelector(s.amount),
            // Core toolbar amount: "Items <first>-<last> of <total>" (3 numbers) or "<total> Items" (1 number).
            numbers = amount ? amount.querySelectorAll('.toolbar-number') : [],
            total = numbers.length ? num(numbers[numbers.length - 1]) : 0,
            firstNum = numbers.length >= 3 ? num(numbers[0]) : 1,
            autoLeft = config.autoloadPages,
            loading = false,
            root = el('div', B),
            count = el('div', B + '__count'),
            progress = el('div', B + '__progress'),
            bar = el('span', B + '__progress-bar'),
            loader = el('div', B + '__loader'),
            button = el('button', 'action secondary ' + B + '__button', labels.showMore),
            status = el('div', B + '__status'),
            observer;

        // No listing or a single/last page: keep the standard pager untouched.
        if (!list || !nextUrl) {
            return;
        }

        button.type = 'button';
        loader.appendChild(el('span', B + '__loader-text', labels.loading));
        // Three empty <i> for a CSS "dots" animation (the module ships no CSS).
        loader.appendChild(el('span', B + '__dots')).innerHTML = '<i></i><i></i><i></i>';
        progress.setAttribute('aria-hidden', 'true');
        progress.appendChild(bar);
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        // Visually hidden, still read by screen readers.
        status.style.cssText = 'position:absolute;width:1px;height:1px;margin:-1px;padding:0;' +
            'overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0';

        if (total) {
            root.appendChild(count);
            root.appendChild(progress);
        }
        root.appendChild(loader);
        root.appendChild(button);
        root.appendChild(status);
        $(button).hide();
        $(loader).hide();
        $(root).insertAfter(document.querySelector(s.insertAfter) || list);

        // Entered on page 1: loading replaces the pager. Entered on ?p>1 (refresh, back, shared link):
        // the earlier pages are reachable only through the pager, so it stays visible.
        // It always stays in the DOM (no-JS / crawler fallback); jQuery inline display wins over theme rules.
        if (startPage <= 1) {
            $(s.pager).hide();
        }

        /**
         * @return {NodeList}
         */
        function items() {
            return list.querySelectorAll(':scope > ' + s.item);
        }

        /**
         * "Shown X of N", progress bar width and the "last" number of the toolbar amount.
         * X = position of the last shown product (an entry on page 3 starts at 25, not at 1).
         */
        function updateCount() {
            var shown;

            if (!total) {
                return;
            }

            shown = Math.min(total, firstNum - 1 + items().length);
            count.textContent = labels.shown.replace('%1', shown).replace('%2', total);
            bar.style.width = Math.round(100 * shown / total) + '%';

            if (numbers.length >= 3) {
                numbers[1].textContent = shown;
            }
        }

        /**
         * Adds (on = true) or removes placeholder items at the end of the list.
         *
         * @param {Boolean} on
         */
        function skeletons(on) {
            var i, li;

            list.querySelectorAll(':scope > .' + B + '__skeleton').forEach(function (node) {
                node.remove();
            });

            for (i = 0; on && i < config.skeletons; i++) {
                li = el('li', B + '__skeleton');
                li.setAttribute('aria-hidden', 'true');
                li.innerHTML = '<span class="' + B + '__skeleton-media"></span>' +
                    '<span class="' + B + '__skeleton-name"></span>' +
                    '<span class="' + B + '__skeleton-price"></span>' +
                    '<span class="' + B + '__skeleton-action"></span>';
                list.appendChild(li);
            }
        }

        /**
         * @param {String} text
         */
        function announce(text) {
            status.textContent = text;
        }

        /**
         * Updates ?p= of the current URL, keeping every other query param (filters, sort, limit, mode).
         *
         * @param {String|null} page
         */
        function replaceUrl(page) {
            var url = new URL(window.location.href);

            if (page) {
                url.searchParams.set(config.pageParam, page);
                window.history.replaceState(window.history.state, '', url.href);
            }
        }

        /**
         * @param {Document} doc - parsed next page
         * @param {String} url - URL it was loaded from
         * @param {Boolean} fromButton
         */
        function append(doc, url, fromButton) {
            var fetched = doc.querySelectorAll(s.container + ' > ' + s.item),
                link = doc.querySelector(s.nextLink),
                page = new URL(url).searchParams.get(config.pageParam),
                added = [];

            skeletons(false);

            fetched.forEach(function (item) {
                var idEl = item.querySelector('[id]'),
                    node;

                // ponytail: dedupe by the first id inside the item (Luma: product-item-info_<id>).
                // An unstable sort can repeat a product on the next page; duplicate ids would make its
                // x-magento-init selectors (swatches, priceBox) re-init the earlier copy.
                if (idEl && document.getElementById(idEl.id)) {
                    return;
                }
                node = document.importNode(item, true);
                list.appendChild(node);
                added.push(node);
            });

            // Stop on the last page, on an empty page, or if the pager points back to itself (no loops).
            nextUrl = fetched.length && link ? new URL(link.getAttribute('href'), url).href : null;
            if (nextUrl === url) {
                nextUrl = null;
            }

            replaceUrl(page);
            updateCount();

            if (added.length) {
                // Bubbles to body -> mage.apply(): processes the appended text/x-magento-init scripts
                // and data-mage-init attributes (catalogAddToCart, swatch-renderer, priceBox).
                $(list).trigger('contentUpdated');

                if (fromButton) {
                    $(added[0]).find('a[href]').first().trigger('focus');
                }
            }

            announce(nextUrl ? labels.loaded.replace('%1', page) : labels.end);
        }

        /**
         * Decides what happens after a load: stop, keep auto-loading or show the button.
         */
        function next() {
            if (!nextUrl) {
                observer.disconnect();
                $(button).hide();

                return;
            }

            if (autoLeft > 0) {
                // Re-observing fires the callback with the current state, so a still-visible
                // sentinel (short page) triggers the next auto-load.
                observer.unobserve(root);
                observer.observe(root);

                return;
            }

            observer.disconnect();
            $(button).show();
        }

        /**
         * @param {Boolean} fromButton
         */
        function load(fromButton) {
            var url = nextUrl;

            if (loading || !url) {
                return;
            }

            loading = true;
            $(button).hide();
            $(loader).show();
            skeletons(true);
            list.setAttribute('aria-busy', 'true');
            announce(labels.loading);

            // Plain GET of the pager URL: same response as for a normal visit, so it is served from FPC.
            fetch(url, {credentials: 'same-origin'})
                .then(function (response) {
                    if (!response.ok) {
                        throw new Error('HTTP ' + response.status);
                    }

                    return response.text();
                })
                .then(function (html) {
                    append(new DOMParser().parseFromString(html, 'text/html'), url, fromButton);
                })
                .catch(function () {
                    // No automatic retry: from now on only the button loads (no request loop).
                    autoLeft = 0;
                    announce(labels.error);
                })
                .then(function () {
                    skeletons(false);
                    loading = false;
                    $(loader).hide();
                    list.removeAttribute('aria-busy');
                    next();
                });
        }

        observer = new IntersectionObserver(function (entries) {
            if (entries[0].isIntersecting && autoLeft > 0 && !loading) {
                autoLeft--;
                load(false);
            }
        }, {rootMargin: '0px 0px ' + config.offset + 'px 0px'});

        button.addEventListener('click', function () {
            load(true);
        });

        updateCount();
        next();
    };
});
