<?php
/**
 * Copyright © 2015 Magento. All rights reserved.
 * See COPYING.txt for license details.
 */
namespace Magento\Framework\App;

interface ScopeFallbackResolverInterface
{
    /**
     * @param string $scope
     * @param int|null $scopeId
     * @param bool $forConfig
     * @return array [scope, scopeId]
     */
    public function getFallbackScope($scope, $scopeId, $forConfig = true);
}
