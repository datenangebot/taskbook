<?php

declare(strict_types=1);

namespace OCA\Taskbook\Service;

use DateTimeImmutable;
use OCA\Taskbook\Db\Entry;
use OCA\Taskbook\Db\EntryMapper;

/** Owns Taskbook's single backend definition of an overdue Entry. */
class OverdueService {
	/** @psalm-suppress PossiblyUnusedMethod Instantiated by Nextcloud dependency injection. */
	public function __construct(
		private EntryMapper $entryMapper,
		private EntryService $entryService,
		private PeriodService $periodService,
	) {
	}

	/** @return list<Entry> */
	public function forUser(string $uid, DateTimeImmutable $today): array {
		return $this->filter($this->entryMapper->findAllForUser($uid), $today);
	}

	public function countForUser(string $uid, DateTimeImmutable $today): int {
		return count($this->forUser($uid, $today));
	}

	/**
	 * @param list<Entry> $entries
	 * @return list<Entry>
	 */
	public function filter(array $entries, DateTimeImmutable $today): array {
		return array_values(array_filter($entries, fn (Entry $entry): bool => $this->isOverdue($entry, $today)));
	}

	public function isOverdue(Entry $entry, DateTimeImmutable $today): bool {
		if ($entry->getStatus() !== 'open' || !in_array($entry->getType(), ['task', 'migrated_task'], true)) {
			return false;
		}

		// Database date-only values must not be compared as UTC instants against
		// midnight in the owner's timezone.
		$target = $this->periodService->format($this->entryService->effectiveTargetDate($entry));
		return match ($entry->getReferenceType()) {
			'day' => $target !== null && $target < $today->format('Y-m-d'),
			'week' => $target !== null && $target < $this->periodService->weekStart($today)->format('Y-m-d'),
			'month' => $target !== null && $target < $this->periodService->monthStart($today)->format('Y-m-d'),
			default => false,
		};
	}
}
