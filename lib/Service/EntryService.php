<?php

declare(strict_types=1);

namespace OCA\Taskbook\Service;

use DateTimeImmutable;
use OCA\Taskbook\Db\Entry;
use OCA\Taskbook\Db\EntryMapper;
use OCA\Taskbook\Exception\ContextNotFoundException;
use OCA\Taskbook\Exception\EntryNotFoundException;
use OCA\Taskbook\Exception\ValidationException;
use OCA\Taskbook\ResponseDefinitions;
use OCP\AppFramework\Db\DoesNotExistException;
use OCP\AppFramework\Db\MultipleObjectsReturnedException;

/** @psalm-import-type TaskbookEntry from ResponseDefinitions */
class EntryService {
	/** @var list<string> */
	public const TYPES = ['task', 'appointment', 'note', 'migrated_task', 'irrelevant_task'];

	/** @var list<string> */
	public const STATUSES = ['open', 'completed'];

	/** @psalm-suppress PossiblyUnusedMethod Instantiated by Nextcloud dependency injection. */
	public function __construct(
		private EntryMapper $entryMapper,
		private ContextService $contextService,
		private PeriodService $periodService,
		private Clock $clock,
	) {
	}

	/** @return TaskbookEntry */
	public function create(
		string $uid,
		mixed $text,
		mixed $type,
		mixed $important,
		mixed $contextId,
		mixed $referenceType,
		mixed $targetDate,
		mixed $status = 'open',
	): array {
		$this->requireUid($uid);
		$period = $this->periodService->validate($referenceType, $targetDate);
		$context = $this->contextService->find($uid, $this->validateId($contextId, 'context'));
		$entry = new Entry();
		$entry->setUid($uid);
		$entry->setText($this->validateText($text));
		$entry->setType($this->validateType($type));
		$entry->setImportant($this->validateImportant($important));
		$entry->setContextId($context->getId());
		$entry->setReferenceType($period['referenceType']);
		$entry->setPrimaryTargetDate($period['targetDate']);
		$entry->setSecondaryTargetDate(null);
		$entry->setStatus($this->validateStatus($status));
		$entry->setCompletedAt($entry->getStatus() === 'completed' ? $this->clock->nowUtc() : null);
		$entry->setCreatedAt($this->clock->nowUtc());
		$entry->setUpdatedAt($this->clock->nowUtc());

		return $this->toResponse($this->entryMapper->create($entry), $context);
	}

	/** @return TaskbookEntry */
	public function update(
		string $uid,
		int $id,
		mixed $text,
		mixed $type,
		mixed $important,
		mixed $contextId,
		mixed $referenceType,
		mixed $targetDate,
		mixed $status,
	): array {
		$entry = $this->find($uid, $id);
		$period = $this->periodService->validate($referenceType, $targetDate);
		$context = $this->contextService->find($uid, $this->validateId($contextId, 'context'));
		$validatedType = $this->validateType($type);
		$targetChanged = $entry->getReferenceType() !== $period['referenceType']
			|| !$this->periodService->sameDate($this->effectiveTargetDate($entry), $period['targetDate']);
		$typeChanged = $entry->getType() !== $validatedType;

		$entry->setText($this->validateText($text));
		$entry->setImportant($this->validateImportant($important));
		$entry->setContextId($context->getId());
		$entry->setReferenceType($period['referenceType']);
		$this->applyTargetAndMigration($entry, $validatedType, $period['targetDate'], $targetChanged, $typeChanged);

		$status = $this->validateStatus($status);
		$entry->setStatus($status);
		$entry->setCompletedAt($status === 'completed' ? ($entry->getCompletedAt() ?? $this->clock->nowUtc()) : null);
		$entry->setUpdatedAt($this->clock->nowUtc());

		return $this->toResponse($this->entryMapper->updateForUser($entry, $uid), $context);
	}

	/** @return TaskbookEntry */
	public function get(string $uid, int $id): array {
		$entry = $this->find($uid, $id);
		try {
			return $this->toResponse($entry, $this->contextService->find($uid, $entry->getContextId()));
		} catch (ContextNotFoundException $exception) {
			throw new EntryNotFoundException('Entry not found.', 0, $exception);
		}
	}

	public function delete(string $uid, int $id): void {
		$this->find($uid, $id);
		$this->entryMapper->deleteForUser($id, $uid);
	}

	public function find(string $uid, int $id): Entry {
		$this->requireUid($uid);
		try {
			return $this->entryMapper->findForUser($id, $uid);
		} catch (DoesNotExistException|MultipleObjectsReturnedException $exception) {
			throw new EntryNotFoundException('Entry not found.', 0, $exception);
		}
	}

	/**
	 * @return TaskbookEntry
	 * @psalm-suppress LessSpecificReturnStatement Entity fields are validated before persistence.
	 */
	public function toResponse(Entry $entry, \OCA\Taskbook\Db\Context $context): array {
		$primary = $entry->getPrimaryTargetDate();
		$secondary = $entry->getSecondaryTargetDate();
		$completedAt = $entry->getCompletedAt();
		return [
			'id' => $entry->getId(),
			'text' => $entry->getText(),
			'type' => $this->responseType($entry->getType()),
			'important' => $entry->isImportant(),
			'contextId' => $entry->getContextId(),
			'context' => $this->contextService->toResponse($context),
			'referenceType' => $this->responseReferenceType($entry->getReferenceType()),
			'primaryTargetDate' => $this->periodService->format($primary),
			'secondaryTargetDate' => $this->periodService->format($secondary),
			'effectiveTargetDate' => $this->periodService->format($secondary ?? $primary),
			'status' => $this->responseStatus($entry->getStatus()),
			'completedAt' => $completedAt === null ? null : $this->formatTimestamp($completedAt),
			'createdAt' => $this->formatTimestamp($entry->getCreatedAt()),
			'updatedAt' => $this->formatTimestamp($entry->getUpdatedAt()),
		];
	}

	public function effectiveTargetDate(Entry $entry): ?DateTimeImmutable {
		return $entry->getSecondaryTargetDate() ?? $entry->getPrimaryTargetDate();
	}

	private function applyTargetAndMigration(Entry $entry, string $requestedType, ?DateTimeImmutable $targetDate, bool $targetChanged, bool $typeChanged): void {
		if ($entry->getReferenceType() === 'none') {
			if (in_array($entry->getType(), ['task', 'migrated_task'], true) && !$typeChanged && $targetChanged) {
				$entry->setType('migrated_task');
				$entry->setSecondaryTargetDate(null);
				return;
			}
			$entry->setPrimaryTargetDate(null);
			$entry->setSecondaryTargetDate(null);
			$entry->setType($requestedType);
			return;
		}

		if ($entry->getType() === 'task' && !$typeChanged && $targetChanged) {
			$entry->setType('migrated_task');
			$entry->setSecondaryTargetDate($targetDate);
			return;
		}

		if ($entry->getType() === 'migrated_task' && !$typeChanged) {
			$entry->setType('migrated_task');
			if ($targetChanged) {
				$entry->setSecondaryTargetDate($targetDate);
			}
			return;
		}

		$entry->setType($requestedType);
		$entry->setPrimaryTargetDate($targetDate);
		$entry->setSecondaryTargetDate(null);
	}

	private function validateText(mixed $text): string {
		if (!is_string($text)) {
			throw new ValidationException('Entry text is required.');
		}
		$text = trim($text);
		if ($text === '' || mb_strlen($text) > 2000) {
			throw new ValidationException('Entry text must contain between 1 and 2000 characters.');
		}
		return $text;
	}

	private function validateType(mixed $type): string {
		if (!is_string($type) || !in_array($type, self::TYPES, true)) {
			throw new ValidationException('Invalid entry type.');
		}
		return $type;
	}

	private function validateImportant(mixed $important): bool {
		if (!is_bool($important)) {
			throw new ValidationException('Important must be a boolean.');
		}
		return $important;
	}

	private function validateStatus(mixed $status): string {
		if (!is_string($status) || !in_array($status, self::STATUSES, true)) {
			throw new ValidationException('Invalid entry status.');
		}
		return $status;
	}

	private function validateId(mixed $value, string $resource): int {
		if (is_string($value) && preg_match('/^[1-9][0-9]*$/D', $value) === 1) {
			$value = (int)$value;
		}
		if (!is_int($value) || $value < 1) {
			throw new ValidationException('Invalid ' . $resource . '.');
		}
		return $value;
	}

	/** @return non-empty-string */
	private function formatTimestamp(DateTimeImmutable $timestamp): string {
		return $timestamp->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d\TH:i:s\Z');
	}

	/** @return 'task'|'appointment'|'note'|'migrated_task'|'irrelevant_task' */
	private function responseType(string $type): string {
		return match ($type) {
			'task' => 'task',
			'appointment' => 'appointment',
			'note' => 'note',
			'migrated_task' => 'migrated_task',
			'irrelevant_task' => 'irrelevant_task',
			default => throw new \LogicException('Unknown persisted entry type.'),
		};
	}

	/** @return 'day'|'week'|'month'|'none' */
	private function responseReferenceType(string $referenceType): string {
		return match ($referenceType) {
			'day' => 'day',
			'week' => 'week',
			'month' => 'month',
			'none' => 'none',
			default => throw new \LogicException('Unknown persisted reference type.'),
		};
	}

	/** @return 'open'|'completed' */
	private function responseStatus(string $status): string {
		return match ($status) {
			'open' => 'open',
			'completed' => 'completed',
			default => throw new \LogicException('Unknown persisted entry status.'),
		};
	}

	private function requireUid(string $uid): void {
		if ($uid === '') {
			throw new ValidationException('An authenticated user is required.');
		}
	}
}
