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
 * @psalm-import-type TaskbookContext from ResponseDefinitions
 * @psalm-suppress UnusedClass Controller routes are discovered by Nextcloud.
 */
class ContextController extends OCSController {
	public function __construct(
		IRequest $request,
		private ContextService $contextService,
		private IUserSession $userSession,
	) {
		parent::__construct(Application::APP_ID, $request);
	}

	/**
	 * List the authenticated user's contexts.
	 *
	 * @return DataResponse<Http::STATUS_OK, list<TaskbookContext>, array{}>
	 *
	 * 200: Contexts returned
	 */
	#[NoAdminRequired]
	#[OpenAPI]
	#[ApiRoute(verb: 'GET', url: '/api/v1/contexts')]
	public function index(): DataResponse {
		return new DataResponse($this->contextService->list($this->uid()));
	}

	/**
	 * Create a context for the authenticated user.
	 *
	 * @param string $title Context title, from 1 through 120 characters.
	 * @param string $icon Context emoji selected from the emoji picker.
	 * @param string $alias Rapid Logging shortcut without the leading @, from 1 through 16 characters.
	 * @return DataResponse<Http::STATUS_CREATED, TaskbookContext, array{}>
	 * @throws OCSBadRequestException Context fields are invalid.
	 *
	 * 201: Context created
	 * 400: Invalid context data
	 */
	#[NoAdminRequired]
	#[OpenAPI]
	#[ApiRoute(verb: 'POST', url: '/api/v1/contexts')]
	public function create(mixed $title, mixed $icon, mixed $alias): DataResponse {
		try {
			return new DataResponse($this->contextService->create($this->uid(), $title, $icon, $alias), Http::STATUS_CREATED);
		} catch (ValidationException $exception) {
			throw new OCSBadRequestException($exception->getMessage(), $exception);
		}
	}

	/**
	 * Update a context owned by the authenticated user.
	 *
	 * @param int $id Context ID.
	 * @param string $title Context title, from 1 through 120 characters.
	 * @param string $icon Context emoji selected from the emoji picker.
	 * @param string $alias Rapid Logging shortcut without the leading @, from 1 through 16 characters.
	 * @return DataResponse<Http::STATUS_OK, TaskbookContext, array{}>
	 * @throws OCSBadRequestException Context fields are invalid.
	 * @throws OCSNotFoundException Context not found.
	 *
	 * 200: Context updated
	 * 400: Invalid context data
	 * 404: Context not found
	 */
	#[NoAdminRequired]
	#[OpenAPI]
	#[ApiRoute(verb: 'PATCH', url: '/api/v1/contexts/{id}', requirements: ['id' => '\\d+'])]
	public function update(int $id, mixed $title, mixed $icon, mixed $alias): DataResponse {
		try {
			return new DataResponse($this->contextService->update($this->uid(), $id, $title, $icon, $alias));
		} catch (ValidationException $exception) {
			throw new OCSBadRequestException($exception->getMessage(), $exception);
		} catch (ContextNotFoundException $exception) {
			throw new OCSNotFoundException($exception->getMessage(), $exception);
		}
	}

	/**
	 * Delete an unused non-default context owned by the authenticated user.
	 *
	 * @param int $id Context ID.
	 * @return DataResponse<Http::STATUS_OK, null, array{}>
	 * @throws OCSBadRequestException Context cannot be deleted safely.
	 * @throws OCSNotFoundException Context not found.
	 *
	 * 200: Context deleted
	 * 400: Context cannot be deleted
	 * 404: Context not found
	 */
	#[NoAdminRequired]
	#[OpenAPI]
	#[ApiRoute(verb: 'DELETE', url: '/api/v1/contexts/{id}', requirements: ['id' => '\\d+'])]
	public function destroy(int $id): DataResponse {
		try {
			$this->contextService->delete($this->uid(), $id);
			return new DataResponse(null);
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
