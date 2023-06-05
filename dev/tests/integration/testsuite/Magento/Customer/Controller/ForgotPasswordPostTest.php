<?php
/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */
declare(strict_types=1);

namespace Magento\Customer\Controller;

use Magento\Config\Model\ResourceModel\Config as CoreConfig;
use Magento\Customer\Model\CustomerRegistry;
use Magento\Customer\Model\ResourceModel\Customer as CustomerResource;
use Magento\Customer\Model\Session;
use Magento\Framework\App\Config\ReinitableConfigInterface;
use Magento\Framework\App\Config\ScopeConfigInterface;
use Magento\Framework\App\Http;
use Magento\Framework\App\Request\Http as HttpRequest;
use Magento\Framework\Exception\NoSuchEntityException;
use Magento\Framework\Intl\DateTimeFactory;
use Magento\Framework\Math\Random;
use Magento\Framework\Message\MessageInterface;
use Magento\Framework\ObjectManagerInterface;
use Magento\Framework\Serialize\Serializer\Json;
use Magento\Framework\Stdlib\CookieManagerInterface;
use Magento\Framework\Stdlib\DateTime;
use Magento\TestFramework\Helper\Bootstrap;
use Magento\TestFramework\Helper\Xpath;
use Magento\TestFramework\Mail\Template\TransportBuilderMock;
use Magento\TestFramework\Request;
use Magento\TestFramework\TestCase\AbstractController;
use Magento\Framework\Api\SearchCriteriaBuilder;
use Magento\Theme\Controller\Result\MessagePlugin;

/**
 * Class checks password forgot scenarios
 *
 * @see \Magento\Customer\Controller\Account\ForgotPasswordPost
 * @magentoDbIsolation enabled
 * @SuppressWarnings(PHPMD.CouplingBetweenObjects)
 */
class ForgotPasswordPostTest extends AbstractController
{
    /** @var ObjectManagerInterface */
    private $objectManager;

    /** @var TransportBuilderMock */
    private $transportBuilderMock;

    /**
     * @var CoreConfig
     */
    protected $resourceConfig;

    /**
     * @var ReinitableConfigInterface
     */
    private $reinitableConfig;

    /**
     * @var ScopeConfigInterface
     */
    private $scopeConfig;

    /**
     * @var DateTimeFactory
     */
    private $dateTimeFactory;

    /**
     * @var CustomerResource
     */
    private $customerResource;

    /**
     * @var Random
     */
    private $random;

    /**
     * @inheritdoc
     */
    protected function setUp(): void
    {
        parent::setUp();

        $this->objectManager = Bootstrap::getObjectManager();
        $this->transportBuilderMock = $this->objectManager->get(TransportBuilderMock::class);
        $this->resourceConfig = $this->_objectManager->get(CoreConfig::class);
        $this->reinitableConfig = $this->_objectManager->get(ReinitableConfigInterface::class);
        $this->scopeConfig = Bootstrap::getObjectManager()->get(ScopeConfigInterface::class);
        $this->dateTimeFactory = $this->objectManager->get(DateTimeFactory::class);
        $this->customerResource = $this->objectManager->get(CustomerResource::class);
        $this->random = $this->objectManager->get(Random::class);
    }

    /**
     * @magentoConfigFixture current_store customer/captcha/enable 0
     *
     * @return void
     */
    public function testWithoutEmail(): void
    {
        $this->getRequest()->setMethod(HttpRequest::METHOD_POST);
        $this->getRequest()->setPostValue(['email' => '']);
        $this->dispatch('customer/account/forgotPasswordPost');
        $this->assertSessionMessages(
            $this->equalTo([(string)__('Please enter your email.')]),
            MessageInterface::TYPE_ERROR
        );
        $this->assertRedirect($this->stringContains('customer/account/forgotpassword'));
    }

    /**
     * Test that forgot password email message displays special characters correctly.
     *
     * @magentoConfigFixture current_store customer/password/limit_password_reset_requests_method 0
     * @codingStandardsIgnoreStart
     * @magentoConfigFixture current_store customer/password/forgot_email_template customer_password_forgot_email_template
     * @codingStandardsIgnoreEnd
     * @magentoConfigFixture current_store customer/password/forgot_email_identity support
     * @magentoConfigFixture current_store general/store_information/name Test special' characters
     * @magentoConfigFixture current_store customer/captcha/enable 0
     * @magentoDataFixture Magento/Customer/_files/customer.php
     *
     * @return void
     */
    public function testForgotPasswordEmailMessageWithSpecialCharacters(): void
    {
        $email = 'customer@example.com';
        $this->getRequest()->setPostValue(['email' => $email]);
        $this->getRequest()->setMethod(HttpRequest::METHOD_POST);
        $this->dispatch('customer/account/forgotPasswordPost');
        $this->assertRedirect($this->stringContains('customer/account/'));
        $this->assertSuccessSessionMessage($email);
        $subject = $this->transportBuilderMock->getSentMessage()->getSubject();
        $this->assertStringContainsString('Test special\' characters', $subject);
    }

    /**
     * @magentoConfigFixture current_store customer/password/limit_password_reset_requests_method 0
     * @codingStandardsIgnoreStart
     * @magentoConfigFixture current_store customer/password/forgot_email_template customer_password_forgot_email_template
     * @codingStandardsIgnoreEnd
     * @magentoConfigFixture current_store customer/password/forgot_email_identity support
     * @magentoConfigFixture current_store customer/captcha/enable 0
     * @magentoDataFixture Magento/Customer/_files/customer.php
     *
     * @return void
     */
    public function testForgotPasswordPostAction(): void
    {
        $email = 'customer@example.com';
        $this->getRequest()->setMethod(HttpRequest::METHOD_POST);
        $this->getRequest()->setPostValue(['email' => $email]);
        $this->dispatch('customer/account/forgotPasswordPost');
        $this->assertRedirect($this->stringContains('customer/account/'));
        $this->assertSuccessSessionMessage($email);
    }

    /**
     * @magentoConfigFixture current_store customer/captcha/enable 0
     *
     * @return void
     */
    public function testForgotPasswordPostWithBadEmailAction(): void
    {
        $this->getRequest()->setMethod(HttpRequest::METHOD_POST);
        $this->getRequest()->setPostValue(['email' => 'bad@email']);
        $this->dispatch('customer/account/forgotPasswordPost');
        $this->assertRedirect($this->stringContains('customer/account/forgotpassword'));
        $this->assertSessionMessages(
            $this->equalTo(['The email address is incorrect. Verify the email address and try again.']),
            MessageInterface::TYPE_ERROR
        );
    }

    /**
     * Assert success session message
     *
     * @param string $email
     * @return void
     */
    private function assertSuccessSessionMessage(string $email): void
    {
        $message = __(
            'If there is an account associated with %1 you will receive an email with a link to reset your password.',
            $email
        );
        $this->assertSessionMessages($this->equalTo([$message]), MessageInterface::TYPE_SUCCESS);
    }

    /**
     * @magentoConfigFixture current_store customer/captcha/enable 0
     * @magentoConfigFixture current_store customer/password/min_time_between_password_reset_requests 0
     * @magentoConfigFixture current_store customer/password/max_number_password_reset_requests 0
     * @magentoDataFixture Magento/Customer/_files/customer.php
     *
     * @return void
     * @throws NoSuchEntityException
     */
    public function testResetLinkSentAfterForgotPassword(): void
    {
        $defaultExpirationPeriod = 2;
        $actualExpirationPeriod = (int) $this->scopeConfig->getValue(
            'customer/password/reset_link_expiration_period',
            \Magento\Store\Model\ScopeInterface::SCOPE_WEBSITE
        );
        $this->assertEquals(
            $defaultExpirationPeriod,
            $actualExpirationPeriod
        );

        $this->resourceConfig->saveConfig(
            'customer/password/reset_link_expiration_period',
            1,
            ScopeConfigInterface::SCOPE_TYPE_DEFAULT,
            0
        );

        $email = 'customer@example.com';

        $this->getRequest()->setPostValue(['email' => $email]);
        $this->getRequest()->setMethod(HttpRequest::METHOD_POST);

        $this->dispatch('customer/account/forgotPasswordPost');
        $this->assertRedirect($this->stringContains('customer/account/'));
        $this->assertSessionMessages(
            $this->equalTo(
                [
                    "If there is an account associated with {$email} you will receive an email with a link "
                    . "to reset your password."
                ]
            ),
            MessageInterface::TYPE_SUCCESS
        );

        $sendMessage = $this->transportBuilderMock->getSentMessage()->getBody()->getParts()[0]->getRawContent();

        $this->assertStringContainsString(
            'There was recently a request to change the password for your account',
            $sendMessage
        );

        /** @var CustomerRegistry $customerRegistry */
        $customerRegistry = $this->_objectManager->get(CustomerRegistry::class);
        $customerData = $customerRegistry->retrieveByEmail($email);
        $token = $customerData->getRpToken();
        $customerId = $customerData->getId();

        $this->assertEquals(
            1,
            Xpath::getElementsCountForXpath(
                sprintf(
                    '//a[contains(@href, \'customer/account/createPassword/?id=%1$d&token=%2$s\')]',
                    $customerId,
                    $token
                ),
                $sendMessage
            )
        );
    }

    /**
     * @magentoConfigFixture current_store customer/captcha/enable 0
     * @magentoConfigFixture current_store customer/password/min_time_between_password_reset_requests 0
     * @magentoConfigFixture current_store customer/password/max_number_password_reset_requests 0
     * @magentoDataFixture Magento/Customer/_files/customer.php
     *
     * @depends testResetLinkSentAfterForgotPassword
     * @return void
     * @throws NoSuchEntityException
     * @throws \Magento\Framework\Exception\AlreadyExistsException
     * @throws \Magento\Framework\Exception\AuthenticationException
     * @throws \Magento\Framework\Exception\LocalizedException
     */
    public function testResetLinkExpirationByTimeout(): void
    {
        $this->reinitableConfig->reinit();
        $email = 'customer@example.com';

        /** @var CustomerRegistry $customerRegistry */
        $customerRegistry = $this->_objectManager->get(CustomerRegistry::class);
        $customerData = $customerRegistry->retrieveByEmail($email);
        $token = $this->random->getUniqueHash();
        $customerData->changeResetPasswordLinkToken($token);
        $customerData->setData('confirmation', 'confirmation');
        $customerData->save();

        $customerId = $customerData->getId();

        $this->resetRequest();
        $this->clearCookieMessagesList();

        /** @var Session $customer */
        $session = Bootstrap::getObjectManager()->get(Session::class);
        $session->setRpToken($token);
        $session->setRpCustomerId($customerId);

        $this->getRequest()->setParam('token', $token)->setParam('id', $customerId);
        $this->dispatch('customer/account/createPassword');
        $this->assertSessionMessages(
            $this->equalTo([]),
            MessageInterface::TYPE_ERROR
        );

        $rpTokenCreatedAt = $this->dateTimeFactory->create()
            ->sub(\DateInterval::createFromDateString('2 hour'))
            ->format(DateTime::DATETIME_PHP_FORMAT);

        $customerSecure = $customerRegistry->retrieveSecureData($customerId);
        $customerSecure->setRpTokenCreatedAt($rpTokenCreatedAt);
        $this->customerResource->save($customerData);

        $this->getRequest()->setParam('token', $token)->setParam('id', $customerId);
        $this->getRequest()->setMethod(HttpRequest::METHOD_GET);
        $this->dispatch('customer/account/createPassword');

        $this->assertSessionMessages(
            $this->equalTo(['Your password reset link has expired.']),
            MessageInterface::TYPE_ERROR
        );
    }

    /**
     * @inheritDoc
     */
    protected function resetRequest(): void
    {
        $this->_objectManager->removeSharedInstance(Http::class);
        $this->_objectManager->removeSharedInstance(Request::class);
        parent::resetRequest();
    }

    /**
     * Clear cookie messages list.
     *
     * @return void
     */
    private function clearCookieMessagesList(): void
    {
        $cookieManager = $this->_objectManager->get(CookieManagerInterface::class);
        $jsonSerializer = $this->_objectManager->get(Json::class);
        $cookieManager->setPublicCookie(
            MessagePlugin::MESSAGES_COOKIES_NAME,
            $jsonSerializer->serialize([])
        );
    }
}
