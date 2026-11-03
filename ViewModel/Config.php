<?php
/**
 * @package     Defox_InfiniteScroll
 * @author      Marcin Lisiecki
 * @copyright   Copyright (c) 2026 deFox
 * @license     GNU General Public License v3.0
 */

declare(strict_types=1);

namespace Defox\InfiniteScroll\ViewModel;

use Magento\Framework\App\Config\ScopeConfigInterface;
use Magento\Framework\Serialize\Serializer\JsonHexTag;
use Magento\Framework\View\Element\Block\ArgumentInterface;
use Magento\Store\Model\ScopeInterface;

/**
 * Builds the options of the Defox_InfiniteScroll/js/infinite-scroll component.
 *
 * Rendered only when catalog/infinite_scroll/enabled = 1 (ifconfig on the block in layout).
 */
class Config implements ArgumentInterface
{
    private const XML_PATH_AUTOLOAD_PAGES = 'catalog/infinite_scroll/autoload_pages';

    public function __construct(
        private readonly ScopeConfigInterface $scopeConfig,
        private readonly JsonHexTag $json
    ) {
    }

    /**
     * Merges layout options (selectors, pageParam, offset, skeletons) with store config and translated labels.
     *
     * @param array<string, mixed> $layoutOptions
     */
    public function getJsonConfig(array $layoutOptions): string
    {
        return $this->json->serialize(array_merge($layoutOptions, [
            'autoloadPages' => max(0, (int) $this->scopeConfig->getValue(
                self::XML_PATH_AUTOLOAD_PAGES,
                ScopeInterface::SCOPE_STORE
            )),
            'labels' => [
                'showMore' => (string) __('Show more'),
                'loading' => (string) __('Loading products...'),
                'loaded' => (string) __('Page %1 loaded.'),
                'end' => (string) __('All products are loaded.'),
                'shown' => (string) __('Shown %1 of %2'),
                'error' => (string) __('Could not load more products. Try again.'),
            ],
        ]));
    }
}
