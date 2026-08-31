<?php

declare(strict_types=1);

namespace OCA\Taskbook\Controller;

use OCA\Taskbook\AppInfo\Application;
use OCA\Taskbook\Exception\ValidationException;
use OCA\Taskbook\ResponseDefinitions;
use OCA\Taskbook\Service\ViewService;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\ApiRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\OpenAPI;
use OCP\AppFramework\Http\DataResponse;
use OCP\AppFramework\OCS\OCSBadRequestException;
use OCP\AppFramework\OCS\OCSException;
use OCP\AppFramework\OCSController;
use OCP\IRequest;
use OCP\IUserSession;

/**
 * @psalm-import-type TaskbookOverview from ResponseDefinitions
 * @psalm-suppress UnusedClass Controller routes are discovered by Nextcloud.
 */
class ViewController extends OCSController {
	public function __construct(
		IRequest $request,
		private ViewService $viewService,
		private IUserSession $userSession,
	) {
		parent::__construct(Application::APP_ID, $request);
	}

	/**
	 * Return the compact current-state overview for the authenticated user.
	 *
	 * @return DataResponse<Http::STATUS_OK, TaskbookOverview, array{}>
	 * @psalm-suppress MoreSpecificReturnType The service's documented response is the public contract.
	 * @psalm-suppress LessSpecificReturnStatement The service's documented response is the public contract.
	 *
	 * 200: Overview returned
	 */
	#[NoAdminRequired]
	#[OpenAPI]
	#[ApiRoute(verb: 'GET', url: '/api/v1/views/overview')]
	public function overview(): DataResponse {
		return new DataResponse($this->viewService->overview($this->uid()));
	}

	/**
	 * Return day entries and inherited week and month entries.
	 *
	 * @param string $date Local calendar date in YYYY-MM-DD format.
	 * @return DataResponse<Http::STATUS_OK, array<string, mixed>, array{}>
	 * @throws OCSBadRequestException Invalid date.
	 *
	 * 200: Day view returned
	 * 400: Invalid date
	 */
	#[NoAdminRequired]
	#[OpenAPI]
	#[ApiRoute(verb: 'GET', url: '/api/v1/views/day')]
	public function day(mixed $date): DataResponse {
		return $this->dated(fn (): array => $this->viewService->day($this->uid(), $date));
	}

	/**
	 * Return the canonical day, week and month entries needed to render a week.
	 *
	 * @param string $date A date in the requested ISO week, in YYYY-MM-DD format.
	 * @return DataResponse<Http::STATUS_OK, array<string, mixed>, array{}>
	 * @throws OCSBadRequestException Invalid date.
	 *
	 * 200: Week view returned
	 * 400: Invalid date
	 */
	#[NoAdminRequired]
	#[OpenAPI]
	#[ApiRoute(verb: 'GET', url: '/api/v1/views/week')]
	public function week(mixed $date): DataResponse {
		return $this->dated(fn (): array => $this->viewService->week($this->uid(), $date));
	}

	/**
	 * Return canonical day, week and month entries needed to render a month calendar.
	 *
	 * @param string $date A date in the requested month, in YYYY-MM-DD format.
	 * @return DataResponse<Http::STATUS_OK, array<string, mixed>, array{}>
	 * @throws OCSBadRequestException Invalid date.
	 *
	 * 200: Month view returned
	 * 400: Invalid date
	 */
	#[NoAdminRequired]
	#[OpenAPI]
	#[ApiRoute(verb: 'GET', url: '/api/v1/views/month')]
	public function month(mixed $date): DataResponse {
		return $this->dated(fn (): array => $this->viewService->month($this->uid(), $date));
	}

	/**
	 * Return no-date and chronologically grouped future entries.
	 *
	 * @return DataResponse<Http::STATUS_OK, array<string, mixed>, array{}>
	 *
	 * 200: Future Log returned
	 */
	#[NoAdminRequired]
	#[OpenAPI]
	#[ApiRoute(verb: 'GET', url: '/api/v1/views/future')]
	public function future(): DataResponse {
		return new DataResponse($this->viewService->future($this->uid()));
	}

	/**
	 * @param callable(): array<string, mixed> $operation
	 * @return DataResponse<Http::STATUS_OK, array<string, mixed>, array{}>
	 */
	private function dated(callable $operation): DataResponse {
		try {
			return new DataResponse($operation(), Http::STATUS_OK);
		} catch (ValidationException $exception) {
			throw new OCSBadRequestException($exception->getMessage(), $exception);
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
