<?php

declare(strict_types=1);

namespace Service;

use DateTimeImmutable;
use DateTimeZone;
use OCA\Taskbook\Db\Context;
use OCA\Taskbook\Db\Entry;
use OCA\Taskbook\Db\EntryMapper;
use OCA\Taskbook\Service\Clock;
use OCA\Taskbook\Service\ContextService;
use OCA\Taskbook\Service\EntryService;
use OCA\Taskbook\Service\PeriodService;
use OCA\Taskbook\Service\ViewService;
use PHPUnit\Framework\TestCase;

final class ViewServiceTest extends TestCase {
	private EntryMapper $entryMapper;
	private ContextService $contextService;
	private EntryService $entryService;
	private PeriodService $periodService;
	private Context $context;

	protected function setUp(): void {
		$this->entryMapper = $this->createMock(EntryMapper::class);
		$this->contextService = $this->createMock(ContextService::class);
		$clock = $this->createMock(Clock::class);
		$clock->method('userTimeZone')->willReturn(new DateTimeZone('Europe/Berlin'));
		$clock->method('today')->willReturn(new DateTimeImmutable('2026-08-30', new DateTimeZone('Europe/Berlin')));
		$this->periodService = new PeriodService($clock);
		$this->entryService = new EntryService($this->entryMapper, $this->contextService, $this->periodService, $clock);
		$this->context = new Context();
		$this->context->setId(1);
		$this->context->setTitle('General');
		$this->context->setIcon('😀');
		$this->context->setAlias('g');
		$this->context->setCreatedAt($this->timestamp());
		$this->context->setUpdatedAt($this->timestamp());
		$this->contextService->method('find')->willReturn($this->context);
		$this->contextService->method('toResponse')->willReturn([
			'id' => 1,
			'title' => 'General',
			'icon' => '😀',
			'alias' => 'g',
			'createdAt' => '2026-08-01T09:00:00Z',
			'updatedAt' => '2026-08-01T09:00:00Z',
		]);
	}

	public function testWeekReadModelIncludesDirectDaysAndApplicableBroaderPeriods(): void {
		$this->entryMapper->method('findAllForUser')->with('alice')->willReturn([
			$this->entry(1, 'day', '2026-08-24'),
			$this->entry(2, 'day', '2026-08-30'),
			$this->entry(3, 'day', '2026-08-31'),
			$this->entry(4, 'week', '2026-08-24'),
			$this->entry(5, 'week', '2026-08-31'),
			$this->entry(6, 'month', '2026-08-01'),
			$this->entry(7, 'month', '2026-09-01'),
		]);

		$response = $this->service()->week('alice', '2026-08-29');

		$this->assertSame('2026-08-24', $response['weekStart']);
		$this->assertSame([1, 2, 4, 6], array_column($response['entries'], 'id'));
	}

	public function testWeekReadModelIncludesBothMonthsAcrossBoundary(): void {
		$this->entryMapper->method('findAllForUser')->willReturn([
			$this->entry(1, 'day', '2026-09-01'),
			$this->entry(2, 'week', '2026-08-31'),
			$this->entry(3, 'month', '2026-08-01'),
			$this->entry(4, 'month', '2026-09-01'),
		]);

		$response = $this->service()->week('alice', '2026-09-01');

		$this->assertSame([1, 2, 3, 4], array_column($response['entries'], 'id'));
	}

	public function testMonthReadModelSeparatesCanonicalDayWeekAndMonthEntries(): void {
		$this->entryMapper->method('findAllForUser')->willReturn([
			$this->entry(1, 'day', '2026-08-01'),
			$this->entry(2, 'day', '2026-08-31'),
			$this->entry(3, 'day', '2026-09-01'),
			$this->entry(4, 'week', '2026-07-27'),
			$this->entry(5, 'week', '2026-08-31'),
			$this->entry(6, 'month', '2026-08-01'),
			$this->entry(7, 'month', '2026-09-01'),
		]);

		$response = $this->service()->month('alice', '2026-08-29');

		$this->assertSame('2026-08-01', $response['monthStart']);
		$this->assertSame([1, 2, 4, 5, 6], array_column($response['entries'], 'id'));
		$this->assertSame([6], array_column($response['sections'][0]['entries'], 'id'));
	}

	public function testMigratedEntryIsAvailableAtOriginalAndCurrentPeriodsWithoutPersistenceDuplication(): void {
		$migrated = $this->entry(8, 'day', '2026-08-24', '2026-08-31');
		$this->entryMapper->method('findAllForUser')->willReturn([$migrated]);

		$originalWeek = $this->service()->week('alice', '2026-08-24');
		$currentWeek = $this->service()->week('alice', '2026-08-31');

		$this->assertSame([8], array_column($originalWeek['entries'], 'id'));
		$this->assertSame([8], array_column($currentWeek['entries'], 'id'));
	}

	public function testOverviewReturnsCanonicalFiveStatisticsAndCountsMigratedEntriesOnce(): void {
		$open = $this->entry(1, 'day', '2026-08-30');
		$completed = $this->entry(2, 'day', '2026-08-30');
		$completed->setStatus('completed');
		$completed->setCompletedAt($this->timestamp());
		$overdue = $this->entry(3, 'day', '2026-08-28');
		$overdueNote = $this->entry(4, 'day', '2026-08-28');
		$overdueNote->setType('note');
		$later = $this->entry(5, 'day', '2026-08-30');
		$later->setReferenceType('none');
		$later->setPrimaryTargetDate(null);
		$migrated = $this->entry(6, 'day', '2026-08-24', '2026-08-29');
		$this->entryMapper->expects($this->once())->method('findAllForUser')->with('alice')->willReturn([$open, $completed, $overdue, $overdueNote, $later, $migrated]);

		$response = $this->service()->overview('alice');

		$this->assertSame([3, 6], array_column($response['overdue'], 'id'));
		$this->assertSame([
			'openItems' => 5,
			'totalItemsCompleted' => 1,
			'overdueItems' => 2,
			'laterItems' => 1,
			'migratedItems' => 1,
		], $response['statistics']);
		$this->assertArrayNotHasKey('today', $response);
	}

	private function service(): ViewService {
		return new ViewService($this->entryMapper, $this->contextService, $this->entryService, $this->periodService);
	}

	private function entry(int $id, string $referenceType, string $target, ?string $secondaryTarget = null): Entry {
		$entry = new Entry();
		$entry->setId($id);
		$entry->setUid('alice');
		$entry->setText('Entry ' . $id);
		$entry->setType($secondaryTarget === null ? 'task' : 'migrated_task');
		$entry->setImportant(false);
		$entry->setContextId(1);
		$entry->setReferenceType($referenceType);
		$entry->setPrimaryTargetDate(new DateTimeImmutable($target, new DateTimeZone('Europe/Berlin')));
		$entry->setSecondaryTargetDate($secondaryTarget === null ? null : new DateTimeImmutable($secondaryTarget, new DateTimeZone('Europe/Berlin')));
		$entry->setStatus('open');
		$entry->setCompletedAt(null);
		$entry->setCreatedAt($this->timestamp()->modify('+' . $id . ' minutes'));
		$entry->setUpdatedAt($this->timestamp());
		return $entry;
	}

	private function timestamp(): DateTimeImmutable {
		return new DateTimeImmutable('2026-08-01T09:00:00Z');
	}
}
