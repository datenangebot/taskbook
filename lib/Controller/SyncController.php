<?php

declare(strict_types=1);

namespace OCA\Taskbook\Controller;

use OCA\Taskbook\AppInfo\Application;
use OCA\Taskbook\Exception\ValidationException;
use OCA\Taskbook\ResponseDefinitions;
use OCA\Taskbook\Service\Clock;
use OCA\Taskbook\Service\SyncService;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\ApiRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\OpenAPI;
use OCP\AppFramework\Http\Attribute\UserRateLimit;
use OCP\AppFramework\Http\DataResponse;
use OCP\AppFramework\OCS\OCSBadRequestException;
use OCP\AppFramework\OCS\OCSException;
use OCP\AppFramework\OCSController;
use OCP\IRequest;
use OCP\IUserSession;

/**
 * @psalm-import-type TaskbookSyncMutation from ResponseDefinitions
 * @psalm-import-type TaskbookSyncResponse from ResponseDefinitions
 * @psalm-suppress UnusedClass Controller routes are discovered by Nextcloud.
 */
class SyncController extends OCSController {
	public function __construct(
		IRequest $request,
		private SyncService $syncService,
		private Clock $clock,
		private IUserSession $userSession,
	) {
		parent::__construct(Application::APP_ID, $request);
	}

	/**
	 * Synchronize one offline Taskbook installation.
	 *
	 * A null cursor requests the initial full dataset. Later calls use the
	 * returned cursor and push at most 100 idempotent mutations.
	 *
	 * @param string $installationId Stable UUID for this installed client.
	 * @param int|null $cursor Last acknowledged server cursor, or null initially.
	 * @param list<TaskbookSyncMutation> $mutations Ordered create, update, and delete mutations.
	 * @return DataResponse<Http::STATUS_OK, TaskbookSyncResponse, array{}>
	 * @throws OCSBadRequestException The sync request or a mutation is invalid.
	 * @psalm-suppress MoreSpecificReturnType The service validates the documented public response shape.
	 * @psalm-suppress LessSpecificReturnStatement The service validates the documented public response shape.
	 *
	 * 200: Synchronization result returned
	 * 400: Invalid synchronization request
	 */
	#[NoAdminRequired]
	#[OpenAPI]
	#[UserRateLimit(limit: 120, period: 60)]
	#[ApiRoute(verb: 'POST', url: '/api/v1/sync')]
	public function sync(mixed $installationId, mixed $cursor = null, mixed $mutations = []): DataResponse {
		try {
			return new DataResponse($this->syncService->sync($this->uid(), $installationId, $cursor, $mutations));
		} catch (ValidationException $exception) {
			throw new OCSBadRequestException($exception->getMessage(), $exception);
		}
	}

	/**
	 * Confirm that Taskbook is reachable with the supplied credentials.
	 *
	 * @return DataResponse<Http::STATUS_OK, array{status: 'ok', serverTime: string}, array{}>
	 *
	 * 200: Taskbook is reachable
	 */
	#[NoAdminRequired]
	#[OpenAPI]
	#[UserRateLimit(limit: 30, period: 60)]
	#[ApiRoute(verb: 'GET', url: '/api/v1/health')]
	public function health(): DataResponse {
		$this->uid();
		return new DataResponse(['status' => 'ok', 'serverTime' => $this->clock->nowUtc()->format('Y-m-d\TH:i:s\Z')]);
	}

	private function uid(): string {
		$user = $this->userSession->getUser();
		if ($user === null) {
			throw new OCSException('Authentication required.', Http::STATUS_UNAUTHORIZED);
		}
		return $user->getUID();
	}
}
