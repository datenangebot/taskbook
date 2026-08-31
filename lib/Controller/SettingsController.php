<?php

declare(strict_types=1);

namespace OCA\Taskbook\Controller;

use OCA\Taskbook\AppInfo\Application;
use OCA\Taskbook\Exception\ContextNotFoundException;
use OCA\Taskbook\Exception\ValidationException;
use OCA\Taskbook\ResponseDefinitions;
use OCA\Taskbook\Service\ContextService;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\ApiRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\OpenAPI;
use OCP\AppFramework\Http\DataResponse;
use OCP\AppFramework\OCS\OCSBadRequestException;
use OCP\AppFramework\OCS\OCSException;
use OCP\AppFramework\OCS\OCSNotFoundException;
use OCP\AppFramework\OCSController;
use OCP\IRequest;
use OCP\IUserSession;

/**
 * @psalm-import-type TaskbookSettings from ResponseDefinitions
 * @psalm-suppress UnusedClass Controller routes are discovered by Nextcloud.
 */
class SettingsController extends OCSController {
	public function __construct(
		IRequest $request,
		private ContextService $contextService,
		private IUserSession $userSession,
	) {
		parent::__construct(Application::APP_ID, $request);
	}

	/**
	 * Return the authenticated user's contexts and default context.
	 *
	 * @return DataResponse<Http::STATUS_OK, TaskbookSettings, array{}>
	 *
	 * 200: Settings returned
	 */
	#[NoAdminRequired]
	#[OpenAPI]
	#[ApiRoute(verb: 'GET', url: '/api/v1/settings')]
	public function get(): DataResponse {
		return new DataResponse($this->contextService->settings($this->uid()));
	}

	/**
	 * Select a default context owned by the authenticated user.
	 *
	 * @param int $contextId Context ID.
	 * @return DataResponse<Http::STATUS_OK, TaskbookSettings, array{}>
	 * @throws OCSBadRequestException Invalid context.
	 * @throws OCSNotFoundException Context not found.
	 *
	 * 200: Default context updated
	 * 400: Invalid context
	 * 404: Context not found
	 */
	#[NoAdminRequired]
	#[OpenAPI]
	#[ApiRoute(verb: 'PUT', url: '/api/v1/settings/default-context')]
	public function setDefault(mixed $contextId): DataResponse {
		try {
			return new DataResponse($this->contextService->setDefault($this->uid(), $contextId));
		} catch (ValidationException $exception) {
			throw new OCSBadRequestException($exception->getMessage(), $exception);
		} catch (ContextNotFoundException $exception) {
			throw new OCSNotFoundException($exception->getMessage(), $exception);
		}
	}

	private function uid(): string {
		$user = $this->userSession->getUser();
		if ($user === null) {
			throw new OCSException('Authentication required.', Http::STATUS_UNAUTHORIZED);
		}
		return $user->getUID();
	}
}
