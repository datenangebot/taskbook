<?php

declare(strict_types=1);

namespace OCA\Taskbook\Service;

use DateTimeImmutable;
use OCA\Taskbook\Db\Entry;
use OCA\Taskbook\Db\EntryMapper;
use OCA\Taskbook\Exception\ValidationException;
use OCA\Taskbook\ResponseDefinitions;

/**
 * Reusable user-scoped read models shared by web views and the Dashboard.
 *
 * @psalm-import-type TaskbookEntry from ResponseDefinitions
 * @psalm-import-type TaskbookOverview from ResponseDefinitions
 */
class ViewService {
	/** @psalm-suppress PossiblyUnusedMethod Instantiated by Nextcloud dependency injection. */
	public function __construct(
		private EntryMapper $entryMapper,
		private ContextService $contextService,
		private EntryService $entryService,
		private PeriodService $periodService,
		private OverdueService $overdueService,
	) {
	}

	/** @return TaskbookOverview */
	public function overview(string $uid): array {
		$today = $this->periodService->today();
		$entries = $this->entries($uid);
		$overdue = $this->sort($this->overdueService->filter($entries, $today));
		return [
			'overdue' => $this->responses($uid, $overdue),
			'statistics' => [
				'openItems' => count($this->filter($entries, fn (Entry $entry): bool => $entry->getStatus() === 'open')),
				'totalItemsCompleted' => count($this->filter($entries, fn (Entry $entry): bool => $entry->getStatus() === 'completed')),
				'overdueItems' => count($overdue),
				'laterItems' => count($this->filter($entries, fn (Entry $entry): bool => $entry->getReferenceType() === 'none')),
				'migratedItems' => count($this->filter($entries, fn (Entry $entry): bool => $entry->getSecondaryTargetDate() !== null)),
			],
		];
	}

	/** @return array{date: string|null, sections: list<array{id: string, kind: string, entries: list<TaskbookEntry>}>} */
	public function day(string $uid, mixed $date): array {
		$day = $this->dayParameter($date);
		$entries = $this->entries($uid);
		return [
			'date' => $this->periodService->format($day),
			'sections' => [
				$this->section('items', 'Items', $uid, $this->filter($entries, fn (Entry $entry): bool => $entry->getReferenceType() === 'day' && $this->targetsDate($entry, $day))),
				$this->section('week', 'Week', $uid, $this->filter($entries, fn (Entry $entry): bool => $entry->getReferenceType() === 'week' && $this->targetsDate($entry, $this->periodService->weekStart($day)))),
				$this->section('month', 'Month', $uid, $this->filter($entries, fn (Entry $entry): bool => $entry->getReferenceType() === 'month' && $this->targetsDate($entry, $this->periodService->monthStart($day)))),
			],
		];
	}

	/** @return array{weekStart: string|null, sections: list<array{id: string, kind: string, entries: list<TaskbookEntry>}>, entries: list<TaskbookEntry>} */
	public function week(string $uid, mixed $date): array {
		$week = $this->periodService->weekStart($this->dayParameter($date));
		$entries = $this->entries($uid);
		$weekEnd = $week->modify('+6 days');
		$sections = [$this->section('items', 'Items', $uid, $this->filter($entries, fn (Entry $entry): bool => $entry->getReferenceType() === 'week' && $this->targetsDate($entry, $week)))];
		$months = [$this->periodService->monthStart($week), $this->periodService->monthStart($weekEnd)];
		$monthKeys = array_unique(array_map(fn (DateTimeImmutable $month): string => $month->format('Y-m-d'), $months));
		foreach ($monthKeys as $monthKey) {
			$month = new DateTimeImmutable($monthKey, $week->getTimezone());
			$sections[] = $this->section('month-' . $monthKey, 'Month', $uid, $this->filter($entries, fn (Entry $entry): bool => $entry->getReferenceType() === 'month' && $this->targetsDate($entry, $month)));
		}
		$visibleEntries = $this->filter($entries, function (Entry $entry) use ($week, $weekEnd, $monthKeys): bool {
			return match ($entry->getReferenceType()) {
				'day' => $this->targetsBetween($entry, $week, $weekEnd),
				'week' => $this->targetsDate($entry, $week),
				'month' => $this->targetsAnyKey($entry, $monthKeys),
				default => false,
			};
		});
		return ['weekStart' => $this->periodService->format($week), 'sections' => $sections, 'entries' => $this->responses($uid, $this->sort($visibleEntries))];
	}

	/** @return array{monthStart: string|null, sections: list<array{id: string, kind: string, entries: list<TaskbookEntry>}>, entries: list<TaskbookEntry>} */
	public function month(string $uid, mixed $date): array {
		$month = $this->periodService->monthStart($this->dayParameter($date));
		$monthEnd = $month->modify('last day of this month');
		$firstWeek = $this->periodService->weekStart($month);
		$lastWeek = $this->periodService->weekStart($monthEnd);
		$entries = $this->entries($uid);
		$visibleEntries = $this->filter($entries, function (Entry $entry) use ($month, $monthEnd, $firstWeek, $lastWeek): bool {
			return match ($entry->getReferenceType()) {
				'day' => $this->targetsBetween($entry, $month, $monthEnd),
				'week' => $this->targetsBetween($entry, $firstWeek, $lastWeek),
				'month' => $this->targetsDate($entry, $month),
				default => false,
			};
		});
		return [
			'monthStart' => $this->periodService->format($month),
			'sections' => [$this->section('items', 'Items', $uid, $this->filter($entries, fn (Entry $entry): bool => $entry->getReferenceType() === 'month' && $this->targetsDate($entry, $month)))],
			'entries' => $this->responses($uid, $this->sort($visibleEntries)),
		];
	}

	/** @return array{sections: list<array{id: string, kind: string, entries: list<TaskbookEntry>}>} */
	public function future(string $uid): array {
		$entries = $this->entries($uid);
		$month = $this->periodService->monthStart($this->periodService->today());
		$sections = [$this->section('later', 'Later / No date', $uid, $this->filter($entries, fn (Entry $entry): bool => $entry->getReferenceType() === 'none'))];
		$groups = [];
		foreach ($entries as $entry) {
			$target = $this->entryService->effectiveTargetDate($entry);
			if ($target !== null && $target > $month) {
				$key = $this->periodService->monthStart($target)->format('Y-m-d');
				$groups[$key][] = $entry;
			}
		}
		ksort($groups);
		foreach ($groups as $key => $group) {
			$sections[] = $this->section('month-' . $key, 'Month', $uid, $group);
		}
		return ['sections' => $sections];
	}

	/**
	 * @param list<Entry> $entries
	 * @return array{id: string, kind: string, entries: list<TaskbookEntry>}
	 */
	private function section(string $id, string $kind, string $uid, array $entries): array {
		return ['id' => $id, 'kind' => $kind, 'entries' => $this->responses($uid, $this->sort($entries))];
	}

	/** @return list<Entry> */
	private function entries(string $uid): array {
		return $this->entryMapper->findAllForUser($uid);
	}

	/**
	 * @param list<Entry> $entries
	 * @return list<TaskbookEntry>
	 */
	private function responses(string $uid, array $entries): array {
		$contexts = [];
		foreach ($entries as $entry) {
			$contextId = $entry->getContextId();
			$contexts[$contextId] ??= $this->contextService->find($uid, $contextId);
		}
		return array_map(fn (Entry $entry): array => $this->entryService->toResponse($entry, $contexts[$entry->getContextId()]), $entries);
	}

	private function dayParameter(mixed $date): DateTimeImmutable {
		return $this->periodService->validate('day', $date)['targetDate'] ?? throw new ValidationException('A date is required.');
	}

	/**
	 * @param list<Entry> $entries
	 * @param callable(Entry):bool $predicate
	 * @return list<Entry>
	 */
	private function filter(array $entries, callable $predicate): array {
		return array_values(array_filter($entries, $predicate));
	}

	/**
	 * @param list<Entry> $entries
	 * @return list<Entry>
	 */
	private function sort(array $entries): array {
		usort($entries, static function (Entry $left, Entry $right): int {
			$status = ($left->getStatus() === 'completed' ? 1 : 0) <=> ($right->getStatus() === 'completed' ? 1 : 0);
			if ($status !== 0) {
				return $status;
			}
			$created = $left->getCreatedAt() <=> $right->getCreatedAt();
			return $created !== 0 ? $created : $left->getId() <=> $right->getId();
		});
		return $entries;
	}

	private function same(?DateTimeImmutable $left, DateTimeImmutable $right): bool {
		return $this->periodService->sameDate($left, $right);
	}

	/** @return list<DateTimeImmutable> */
	private function displayTargets(Entry $entry): array {
		$effective = $this->entryService->effectiveTargetDate($entry);
		if ($effective === null) {
			return [];
		}
		$primary = $entry->getPrimaryTargetDate();
		if ($entry->getType() === 'migrated_task' && $entry->getSecondaryTargetDate() !== null && $primary !== null && !$this->same($primary, $effective)) {
			return [$primary, $effective];
		}
		return [$effective];
	}

	private function targetsDate(Entry $entry, DateTimeImmutable $target): bool {
		foreach ($this->displayTargets($entry) as $entryTarget) {
			if ($this->same($entryTarget, $target)) {
				return true;
			}
		}
		return false;
	}

	private function targetsBetween(Entry $entry, DateTimeImmutable $start, DateTimeImmutable $end): bool {
		foreach ($this->displayTargets($entry) as $target) {
			if ($target >= $start && $target <= $end) {
				return true;
			}
		}
		return false;
	}

	/** @param array<array-key, string> $keys */
	private function targetsAnyKey(Entry $entry, array $keys): bool {
		foreach ($this->displayTargets($entry) as $target) {
			if (in_array($target->format('Y-m-d'), $keys, true)) {
				return true;
			}
		}
		return false;
	}
}
