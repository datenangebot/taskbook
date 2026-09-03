<?php

declare(strict_types=1);

namespace Service;

use DateTimeImmutable;
use DateTimeZone;
use OCA\Taskbook\Db\Context;
use OCA\Taskbook\Db\Entry;
use OCA\Taskbook\Db\EntryMapper;
use OCA\Taskbook\Exception\EntryNotFoundException;
use OCA\Taskbook\Service\Clock;
use OCA\Taskbook\Service\ContextService;
use OCA\Taskbook\Service\EntryService;
use OCA\Taskbook\Service\PeriodService;
use OCP\AppFramework\Db\DoesNotExistException;
use PHPUnit\Framework\TestCase;

final class EntryServiceTest extends TestCase {
	private EntryMapper $entryMapper;
	private ContextService $contextService;
	private PeriodService $periodService;
	private Clock $clock;
	private Context $context;

	protected function setUp(): void {
		$this->entryMapper = $this->createMock(EntryMapper::class);
		$this->contextService = $this->createMock(ContextService::class);
		$this->periodService = $this->createMock(PeriodService::class);
		$this->clock = $this->createMock(Clock::class);
		$this->context = new Context();
		$this->context->setId(7);
		$this->context->setTitle('General');
		$this->context->setIcon('folder');
		$this->context->setCreatedAt($this->now());
		$this->context->setUpdatedAt($this->now());
		$this->contextService->method('find')->willReturn($this->context);
		$this->contextService->method('toResponse')->willReturn(['id' => 7, 'title' => 'General', 'icon' => 'folder', 'alias' => 'g', 'createdAt' => '2026-08-28T09:00:00Z', 'updatedAt' => '2026-08-28T09:00:00Z']);
		$this->clock->method('nowUtc')->willReturn($this->now());
	}

	public function testChangingTaskTargetMigratesAndPreservesPrimaryDate(): void {
		$entry = $this->entry('task', '2026-08-28');
		$newTarget = new DateTimeImmutable('2026-08-31', new DateTimeZone('Europe/Berlin'));
		$this->periodService->method('validate')->willReturn(['referenceType' => 'day', 'targetDate' => $newTarget]);
		$this->periodService->method('sameDate')->willReturn(false);
		$this->periodService->method('format')->willReturnCallback(static fn (?DateTimeImmutable $date): ?string => $date?->format('Y-m-d'));
		$this->entryMapper->method('findForUser')->with(3, 'alice')->willReturn($entry);
		$this->entryMapper->method('updateForUser')->willReturnCallback(static fn (Entry $updated): Entry => $updated);

		$this->service()->update('alice', 3, 'Pay invoice', 'task', false, 7, 'day', '2026-08-31', 'open');

		$this->assertSame('migrated_task', $entry->getType());
		$this->assertSame('2026-08-28', $entry->getPrimaryTargetDate()?->format('Y-m-d'));
		$this->assertSame('2026-08-31', $entry->getSecondaryTargetDate()?->format('Y-m-d'));
	}

	public function testRepeatedMigrationReplacesOnlySecondaryDate(): void {
		$entry = $this->entry('migrated_task', '2026-08-28', '2026-08-31');
		$newTarget = new DateTimeImmutable('2026-09-05', new DateTimeZone('Europe/Berlin'));
		$this->periodService->method('validate')->willReturn(['referenceType' => 'day', 'targetDate' => $newTarget]);
		$this->periodService->method('sameDate')->willReturn(false);
		$this->periodService->method('format')->willReturnCallback(static fn (?DateTimeImmutable $date): ?string => $date?->format('Y-m-d'));
		$this->entryMapper->method('findForUser')->willReturn($entry);
		$this->entryMapper->method('updateForUser')->willReturnCallback(static fn (Entry $updated): Entry => $updated);

		$this->service()->update('alice', 3, 'Pay invoice', 'migrated_task', false, 7, 'day', '2026-09-05', 'open');

		$this->assertSame('2026-08-28', $entry->getPrimaryTargetDate()?->format('Y-m-d'));
		$this->assertSame('2026-09-05', $entry->getSecondaryTargetDate()?->format('Y-m-d'));
	}

	public function testMovingTaskToLaterMigratesAndPreservesItsOriginalDate(): void {
		$entry = $this->entry('task', '2026-08-28');
		$this->periodService->method('validate')->willReturn(['referenceType' => 'none', 'targetDate' => null]);
		$this->periodService->method('sameDate')->willReturn(false);
		$this->periodService->method('format')->willReturnCallback(static fn (?DateTimeImmutable $date): ?string => $date?->format('Y-m-d'));
		$this->entryMapper->method('findForUser')->willReturn($entry);
		$this->entryMapper->method('updateForUser')->willReturnCallback(static fn (Entry $updated): Entry => $updated);

		$this->service()->update('alice', 3, 'Pay invoice', 'task', false, 7, 'none', null, 'open');

		$this->assertSame('migrated_task', $entry->getType());
		$this->assertSame('2026-08-28', $entry->getPrimaryTargetDate()?->format('Y-m-d'));
		$this->assertNull($entry->getSecondaryTargetDate());
	}

	public function testReschedulingNoteDoesNotMigrateIt(): void {
		$entry = $this->entry('note', '2026-08-28');
		$newTarget = new DateTimeImmutable('2026-08-31', new DateTimeZone('Europe/Berlin'));
		$this->periodService->method('validate')->willReturn(['referenceType' => 'day', 'targetDate' => $newTarget]);
		$this->periodService->method('sameDate')->willReturn(false);
		$this->periodService->method('format')->willReturnCallback(static fn (?DateTimeImmutable $date): ?string => $date?->format('Y-m-d'));
		$this->entryMapper->method('findForUser')->willReturn($entry);
		$this->entryMapper->method('updateForUser')->willReturnCallback(static fn (Entry $updated): Entry => $updated);

		$this->service()->update('alice', 3, 'Project idea', 'note', false, 7, 'day', '2026-08-31', 'open');

		$this->assertSame('note', $entry->getType());
		$this->assertSame('2026-08-31', $entry->getPrimaryTargetDate()?->format('Y-m-d'));
		$this->assertNull($entry->getSecondaryTargetDate());
	}

	public function testOtherUserCannotUpdateAnEntryById(): void {
		$this->entryMapper->expects($this->once())
			->method('findForUser')
			->with(3, 'bob')
			->willThrowException(new DoesNotExistException('Entry not found.'));
		$this->entryMapper->expects($this->never())->method('updateForUser');

		$this->expectException(EntryNotFoundException::class);
		$this->service()->update('bob', 3, 'Pay invoice', 'task', false, 7, 'day', '2026-08-31', 'open');
	}

	public function testNormalEntryResponseDoesNotExposeSyncMetadata(): void {
		$entry = $this->entry('task', '2026-08-28');
		$entry->setClientUid('f02e095c-4bc4-4a0b-bd56-442e1141387e');
		$entry->setRevision(2);
		$this->periodService->method('format')->willReturnCallback(static fn (?DateTimeImmutable $date): ?string => $date?->format('Y-m-d'));

		$response = $this->service()->toResponse($entry, $this->context);

		self::assertArrayNotHasKey('clientUid', $response);
		self::assertArrayNotHasKey('revision', $response);
	}

	private function service(): EntryService {
		return new EntryService($this->entryMapper, $this->contextService, $this->periodService, $this->clock);
	}

	private function entry(string $type, string $primaryDate, ?string $secondaryDate = null): Entry {
		$entry = new Entry();
		$entry->setId(3);
		$entry->setUid('alice');
		$entry->setText($type === 'note' ? 'Project idea' : 'Pay invoice');
		$entry->setType($type);
		$entry->setImportant(false);
		$entry->setContextId(7);
		$entry->setReferenceType('day');
		$entry->setPrimaryTargetDate(new DateTimeImmutable($primaryDate, new DateTimeZone('Europe/Berlin')));
		$entry->setSecondaryTargetDate($secondaryDate === null ? null : new DateTimeImmutable($secondaryDate, new DateTimeZone('Europe/Berlin')));
		$entry->setStatus('open');
		$entry->setCompletedAt(null);
		$entry->setCreatedAt($this->now());
		$entry->setUpdatedAt($this->now());
		return $entry;
	}

	private function now(): DateTimeImmutable {
		return new DateTimeImmutable('2026-08-28T09:00:00Z');
	}
}
