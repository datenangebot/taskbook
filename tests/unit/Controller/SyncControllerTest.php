<?php

declare(strict_types=1);

namespace Controller;

use OCA\Taskbook\Controller\SyncController;
use OCA\Taskbook\Service\Clock;
use OCA\Taskbook\Service\SyncService;
use OCP\AppFramework\Http;
use OCP\AppFramework\OCS\OCSException;
use OCP\IRequest;
use OCP\IUserSession;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class SyncControllerTest extends TestCase {
	/** @return iterable<string, array{callable(SyncController): void}> */
	public static function protectedActions(): iterable {
		yield 'sync' => [static fn (SyncController $controller): mixed => $controller->sync('00000000-0000-4000-8000-000000000001')];
		yield 'health' => [static fn (SyncController $controller): mixed => $controller->health()];
	}

	#[DataProvider('protectedActions')]
	public function testSyncEndpointsRejectAnUnauthenticatedRequest(callable $action): void {
		$session = $this->createMock(IUserSession::class);
		$session->method('getUser')->willReturn(null);
		$service = $this->createMock(SyncService::class);
		$service->expects($this->never())->method('sync');
		$controller = new SyncController($this->createMock(IRequest::class), $service, $this->createMock(Clock::class), $session);

		try {
			$action($controller);
			$this->fail('The endpoint accepted an unauthenticated request.');
		} catch (OCSException $exception) {
			$this->assertSame(Http::STATUS_UNAUTHORIZED, $exception->getCode());
		}
	}
}
