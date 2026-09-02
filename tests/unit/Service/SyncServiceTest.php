<?php

declare(strict_types=1);

namespace Service;

use DateTimeImmutable;
use DateTimeZone;
use OCA\Taskbook\Db\Context;
use OCA\Taskbook\Db\Entry;
use OCA\Taskbook\Db\EntryMapper;
use OCA\Taskbook\Db\SyncChange;
use OCA\Taskbook\Db\SyncChangeMapper;
use OCA\Taskbook\Db\SyncOperation;
use OCA\Taskbook\Db\SyncOperationMapper;
use OCA\Taskbook\Service\Clock;
use OCA\Taskbook\Service\ContextService;
use OCA\Taskbook\Service\EntryService;
use OCA\Taskbook\Service\SyncService;
use OCP\IConfig;
use OCP\IDBConnection;
use PHPUnit\Framework\TestCase;

final class SyncServiceTest extends TestCase {
	private const INSTALLATION = '00000000-0000-4000-8000-000000000001';
	private const OPERATION = '00000000-0000-4000-8000-000000000002';
	private const CLIENT_UID = '00000000-0000-4000-8000-000000000003';

	private EntryMapper $entryMapper;
	private EntryService $entryService;
	private ContextService $contextService;
	private SyncChangeMapper $changeMapper;
	private SyncOperationMapper $operationMapper;
	private IDBConnection $connection;
	private Clock $clock;
	private IConfig $config;

	protected function setUp(): void {
		$this->entryMapper = $this->createMock(EntryMapper::class);
		$this->entryService = $this->createMock(EntryService::class);
		$this->contextService = $this->createMock(ContextService::class);
		$this->changeMapper = $this->createMock(SyncChangeMapper::class);
		$this->operationMapper = $this->createMock(SyncOperationMapper::class);
		$this->connection = $this->createMock(IDBConnection::class);
		$this->clock = $this->createMock(Clock::class);
		$this->config = $this->createMock(IConfig::class);
		$this->clock->method('nowUtc')->willReturn(new DateTimeImmutable('2026-09-01T08:00:00Z'));
		$this->clock->method('userTimeZone')->willReturn(new DateTimeZone('Europe/Berlin'));
		$this->config->method('getUserValue')->willReturn('de');
		$this->contextService->method('settings')->willReturn(['defaultContextId' => 1, 'contexts' => [$this->contextResponse()]]);
	}

	public function testRepeatedOperationReturnsStoredResultWithoutApplyingItAgain(): void {
		$stored = new SyncOperation();
		$stored->setResultJson(json_encode(['acknowledged' => true, 'change' => $this->entryResponse(1)], JSON_THROW_ON_ERROR));
		$this->operationMapper->method('findForUser')->with(self::OPERATION, 'alice')->willReturn($stored);
		$this->entryService->expects($this->never())->method('createForSync');
		$this->connection->expects($this->never())->method('beginTransaction');
		$this->changeMapper->method('findAfterForUser')->willReturn([]);

		$result = $this->service()->sync('alice', self::INSTALLATION, 0, [$this->mutation('create', 0)]);

		$this->assertSame([self::OPERATION], $result['acknowledgedOperationIds']);
		$this->assertCount(1, $result['canonicalChanges']);
		$this->assertSame(self::CLIENT_UID, $result['canonicalChanges'][0]['clientUid']);
	}

	public function testRevisionMismatchPreservesBothVersionsAsAConflict(): void {
		$entry = $this->entry(4, 'alice');
		$this->operationMapper->method('findForUser')->willReturn(null);
		$this->operationMapper->expects($this->once())->method('create');
		$this->entryService->expects($this->exactly(2))->method('findByClientUid')->with('alice', self::CLIENT_UID)->willReturn($entry);
		$this->entryMapper->expects($this->never())->method('claimRevisionForUser');
		$this->entryService->method('toSyncResponse')->willReturn($this->entryResponse(4, 'Server text'));
		$this->contextService->method('find')->willReturn($this->context());
		$this->changeMapper->method('findAfterForUser')->willReturn([]);

		$result = $this->service()->sync('alice', self::INSTALLATION, 0, [$this->mutation('update', 3, 'Local text')]);

		$this->assertSame([], $result['acknowledgedOperationIds']);
		$this->assertSame('revision_mismatch', $result['conflicts'][0]['reason']);
		$this->assertSame('Local text', $result['conflicts'][0]['localEntry']['text']);
		$this->assertSame('Server text', $result['conflicts'][0]['serverEntry']['text']);
	}

	public function testAuthenticatedOwnerIsAlwaysUsedForClientUidLookup(): void {
		$entry = $this->entry(2, 'bob');
		$this->operationMapper->method('findForUser')->with(self::OPERATION, 'bob')->willReturn(null);
		$this->operationMapper->expects($this->once())->method('create');
		$this->entryService->expects($this->exactly(2))->method('findByClientUid')->with('bob', self::CLIENT_UID)->willReturn($entry);
		$this->entryService->method('toSyncResponse')->willReturn($this->entryResponse(2));
		$this->contextService->method('find')->willReturn($this->context());
		$this->changeMapper->method('findAfterForUser')->willReturn([]);

		$this->service()->sync('bob', self::INSTALLATION, 0, [$this->mutation('update', 1)]);
	}

	public function testIncrementalPullIncludesDeletionTombstonesAndAdvancesCursor(): void {
		$change = new SyncChange();
		$change->setId(9);
		$change->setClientUid(self::CLIENT_UID);
		$change->setOperation('delete');
		$change->setRevision(5);
		$this->changeMapper->method('findAfterForUser')->with(3, 'alice', 501)->willReturn([$change]);

		$result = $this->service()->sync('alice', self::INSTALLATION, 3, []);

		$this->assertSame([['clientUid' => self::CLIENT_UID, 'revision' => 5]], $result['deletions']);
		$this->assertSame(9, $result['nextCursor']);
		$this->assertFalse($result['hasMore']);
	}

	/** @return array<string, mixed> */
	private function mutation(string $type, int $baseRevision, string $text = 'Local text'): array {
		return [
			'type' => $type,
			'operationId' => self::OPERATION,
			'clientUid' => self::CLIENT_UID,
			'baseRevision' => $baseRevision,
			'entry' => ['text' => $text, 'type' => 'task', 'important' => false, 'contextId' => 1, 'referenceType' => 'day', 'targetDate' => '2026-09-01', 'status' => 'open'],
		];
	}

	private function entry(int $revision, string $uid): Entry {
		$entry = new Entry();
		$entry->setId(7);
		$entry->setUid($uid);
		$entry->setClientUid(self::CLIENT_UID);
		$entry->setRevision($revision);
		$entry->setContextId(1);
		return $entry;
	}

	private function context(): Context {
		$context = new Context();
		$context->setId(1);
		return $context;
	}

	/** @return array<string, mixed> */
	private function contextResponse(): array {
		return ['id' => 1, 'title' => 'General', 'icon' => '🗂️', 'alias' => 'g', 'revision' => 1, 'createdAt' => '2026-09-01T08:00:00Z', 'updatedAt' => '2026-09-01T08:00:00Z'];
	}

	/** @return array<string, mixed> */
	private function entryResponse(int $revision, string $text = 'Task'): array {
		return [
			'id' => 7, 'clientUid' => self::CLIENT_UID, 'revision' => $revision, 'text' => $text, 'type' => 'task', 'important' => false,
			'contextId' => 1, 'context' => $this->contextResponse(), 'referenceType' => 'day', 'primaryTargetDate' => '2026-09-01',
			'secondaryTargetDate' => null, 'effectiveTargetDate' => '2026-09-01', 'status' => 'open', 'completedAt' => null,
			'createdAt' => '2026-09-01T08:00:00Z', 'updatedAt' => '2026-09-01T08:00:00Z',
		];
	}

	private function service(): SyncService {
		return new SyncService($this->entryMapper, $this->entryService, $this->contextService, $this->changeMapper, $this->operationMapper, $this->connection, $this->clock, $this->config);
	}
}
