<?php

declare(strict_types=1);

namespace OCA\Taskbook\Controller;

use OCA\Taskbook\AppInfo\Application;
use OCA\Taskbook\Exception\EntryNotFoundException;
use OCA\Taskbook\Exception\ValidationException;
use OCA\Taskbook\ResponseDefinitions;
use OCA\Taskbook\Service\EntryService;
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
 * @psalm-import-type TaskbookEntry from ResponseDefinitions
 * @psalm-suppress UnusedClass Controller routes are discovered by Nextcloud.
 */
class EntryController extends OCSController {
	public function __construct(
		IRequest $request,
		private EntryService $entryService,
		private IUserSession $userSession,
	) {
		parent::__construct(Application::APP_ID, $request);
	}

	/**
	 * Return one entry owned by the authenticated user.
	 *
	 * @param int $id Entry ID.
	 * @return DataResponse<Http::STATUS_OK, TaskbookEntry, array{}>
	 * @throws OCSNotFoundException The entry does not exist or is not owned by the current user.
	 * @psalm-suppress MoreSpecificReturnType The service's documented response is the public contract.
	 * @psalm-suppress LessSpecificReturnStatement The service's documented response is the public contract.
	 *
	 * 200: Entry returned
	 * 404: Entry not found
	 */
	#[NoAdminRequired]
	#[OpenAPI]
	#[ApiRoute(verb: 'GET', url: '/api/v1/entries/{id}', requirements: ['id' => '\\d+'])]
	public function get(int $id): DataResponse {
		try {
			return new DataResponse($this->entryService->get($this->uid(), $id));
		} catch (EntryNotFoundException $exception) {
			throw new OCSNotFoundException($exception->getMessage(), $exception);
		}
	}

	/**
	 * Create one entry in the authenticated user's Taskbook.
	 *
	 * @param string $text Plain-text entry content, from 1 through 2000 characters.
	 * @param string $type Entry type: task, appointment, note, migrated_task, or irrelevant_task.
	 * @param bool $important Whether the entry is important.
	 * @param int $contextId ID of a context owned by the authenticated user.
	 * @param string $referenceType Time reference: day, week, month, or none.
	 * @param string|null $targetDate Date-only target in YYYY-MM-DD format, or null for none.
	 * @param string $status Status: open or completed. Defaults to open.
	 * @return DataResponse<Http::STATUS_CREATED, TaskbookEntry, array{}>
	 * @throws OCSBadRequestException Entry fields are invalid.
	 * @psalm-suppress MoreSpecificReturnType The service's documented response is the public contract.
	 * @psalm-suppress LessSpecificReturnStatement The service's documented response is the public contract.
	 *
	 * 201: Entry created
	 * 400: Invalid entry data
	 */
	#[NoAdminRequired]
	#[OpenAPI]
	#[ApiRoute(verb: 'POST', url: '/api/v1/entries')]
	public function create(mixed $text, mixed $type, mixed $important, mixed $contextId, mixed $referenceType, mixed $targetDate, mixed $status = 'open'): DataResponse {
		try {
			return new DataResponse($this->entryService->create($this->uid(), $text, $type, $important, $contextId, $referenceType, $targetDate, $status), Http::STATUS_CREATED);
		} catch (ValidationException $exception) {
			throw new OCSBadRequestException($exception->getMessage(), $exception);
		}
	}

	/**
	 * Replace an entry's mutable fields and return canonical migration and date state.
	 *
	 * @param int $id Entry ID.
	 * @param string $text Plain-text entry content, from 1 through 2000 characters.
	 * @param string $type Entry type: task, appointment, note, migrated_task, or irrelevant_task.
	 * @param bool $important Whether the entry is important.
	 * @param int $contextId ID of a context owned by the authenticated user.
	 * @param string $referenceType Time reference: day, week, month, or none.
	 * @param string|null $targetDate Date-only target in YYYY-MM-DD format, or null for none.
	 * @param string $status Status: open or completed.
	 * @return DataResponse<Http::STATUS_OK, TaskbookEntry, array{}>
	 * @throws OCSBadRequestException Entry fields are invalid.
	 * @throws OCSNotFoundException The entry does not exist or is not owned by the current user.
	 * @psalm-suppress MoreSpecificReturnType The service's documented response is the public contract.
	 * @psalm-suppress LessSpecificReturnStatement The service's documented response is the public contract.
	 *
	 * 200: Entry updated
	 * 400: Invalid entry data
	 * 404: Entry not found
	 */
	#[NoAdminRequired]
	#[OpenAPI]
	#[ApiRoute(verb: 'PATCH', url: '/api/v1/entries/{id}', requirements: ['id' => '\\d+'])]
	public function update(int $id, mixed $text, mixed $type, mixed $important, mixed $contextId, mixed $referenceType, mixed $targetDate, mixed $status): DataResponse {
		try {
			return new DataResponse($this->entryService->update($this->uid(), $id, $text, $type, $important, $contextId, $referenceType, $targetDate, $status));
		} catch (ValidationException $exception) {
			throw new OCSBadRequestException($exception->getMessage(), $exception);
		} catch (EntryNotFoundException $exception) {
			throw new OCSNotFoundException($exception->getMessage(), $exception);
		}
	}

	/**
	 * Permanently delete one entry owned by the authenticated user.
	 *
	 * @param int $id Entry ID.
	 * @return DataResponse<Http::STATUS_OK, null, array{}>
	 * @throws OCSNotFoundException The entry does not exist or is not owned by the current user.
	 *
	 * 200: Entry deleted
	 * 404: Entry not found
	 */
	#[NoAdminRequired]
	#[OpenAPI]
	#[ApiRoute(verb: 'DELETE', url: '/api/v1/entries/{id}', requirements: ['id' => '\\d+'])]
	public function destroy(int $id): DataResponse {
		try {
			$this->entryService->delete($this->uid(), $id);
			return new DataResponse(null);
		} catch (EntryNotFoundException $exception) {
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
