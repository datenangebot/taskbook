<?php

declare(strict_types=1);

namespace OCA\Taskbook\Service;

use JsonException;
use OCA\Taskbook\Db\Entry;
use OCA\Taskbook\Db\EntryMapper;
use OCA\Taskbook\Db\SyncChangeMapper;
use OCA\Taskbook\Db\SyncOperation;
use OCA\Taskbook\Db\SyncOperationMapper;
use OCA\Taskbook\Exception\EntryNotFoundException;
use OCA\Taskbook\Exception\ValidationException;
use OCP\IConfig;
use OCP\IDBConnection;

/** @psalm-type SyncMutation = array{type: 'create'|'update'|'delete', operationId: string, clientUid: string, baseRevision: int, entry: array<string, mixed>|null} */
class SyncService {
	private const MAX_MUTATIONS = 100;
	private const PULL_LIMIT = 500;
	private const UUID_PATTERN = '/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iD';

	/** @psalm-suppress PossiblyUnusedMethod Instantiated by Nextcloud dependency injection. */
	public function __construct(
		private EntryMapper $entryMapper,
		private EntryService $entryService,
		private ContextService $contextService,
		private SyncChangeMapper $changeMapper,
		private SyncOperationMapper $operationMapper,
		private IDBConnection $connection,
		private Clock $clock,
		private IConfig $config,
	) {
	}

	/** @return array<string, mixed> */
	public function sync(string $uid, mixed $installationId, mixed $cursor, mixed $mutations): array {
		$installationId = $this->uuid($installationId, 'installation');
		$cursor = $this->cursor($cursor);
		$mutations = $this->mutations($mutations);
		/** @var list<array<string, mixed>> $changes */
		$changes = [];
		/** @var list<array<string, mixed>> $deletions */
		$deletions = [];
		/** @var list<array<string, mixed>> $conflicts */
		$conflicts = [];
		/** @var list<string> $acknowledged */
		$acknowledged = [];

		foreach ($mutations as $mutation) {
			$result = $this->applyIdempotently($uid, $installationId, $mutation);
			if (($result['acknowledged'] ?? false) === true) {
				$acknowledged[] = $mutation['operationId'];
			}
			if (isset($result['change']) && is_array($result['change'])) {
				/** @var array<string, mixed> $change */
				$change = $result['change'];
				$changes[] = $change;
			}
			if (isset($result['deletion']) && is_array($result['deletion'])) {
				/** @var array<string, mixed> $deletion */
				$deletion = $result['deletion'];
				$deletions[] = $deletion;
			}
			if (isset($result['conflict']) && is_array($result['conflict'])) {
				/** @var array<string, mixed> $conflict */
				$conflict = $result['conflict'];
				$conflicts[] = $conflict;
			}
		}

		$pull = $this->pull($uid, $cursor);
		/** @var list<array<string, mixed>> $changes */
		$changes = $this->deduplicate([...$changes, ...$pull['changes']], 'clientUid');
		/** @var list<array<string, mixed>> $deletions */
		$deletions = $this->deduplicate([...$deletions, ...$pull['deletions']], 'clientUid');
		$deletedUids = [];
		foreach ($deletions as $deletion) {
			if (isset($deletion['clientUid']) && is_string($deletion['clientUid'])) {
				$deletedUids[$deletion['clientUid']] = true;
			}
		}
		/** @var list<array<string, mixed>> $visibleChanges */
		$visibleChanges = [];
		foreach ($changes as $change) {
			if (!isset($change['clientUid']) || !is_string($change['clientUid']) || !isset($deletedUids[$change['clientUid']])) {
				$visibleChanges[] = $change;
			}
		}
		$changes = $visibleChanges;
		$settings = $this->contextService->settings($uid);

		return [
			'canonicalChanges' => $changes,
			'deletions' => $deletions,
			'contexts' => $settings['contexts'],
			'defaultContextId' => $settings['defaultContextId'],
			'acknowledgedOperationIds' => array_values(array_unique($acknowledged)),
			'conflicts' => $conflicts,
			'nextCursor' => $pull['nextCursor'],
			'hasMore' => $pull['hasMore'],
			'serverTime' => $this->clock->nowUtc()->format('Y-m-d\TH:i:s\Z'),
			'timezone' => $this->clock->userTimeZone()->getName(),
			'locale' => $this->config->getUserValue($uid, 'core', 'lang', 'en'),
		];
	}

	/** @param SyncMutation $mutation @return array<string, mixed> */
	private function applyIdempotently(string $uid, string $installationId, array $mutation): array {
		$stored = $this->operationMapper->findForUser($mutation['operationId'], $uid);
		if ($stored !== null) {
			try {
				$decoded = json_decode($stored->getResultJson(), true, 32, JSON_THROW_ON_ERROR);
				if (!is_array($decoded)) {
					throw new \LogicException('Invalid stored synchronization result.');
				}
				/** @var array<string, mixed> $decoded */
				return $decoded;
			} catch (JsonException $exception) {
				throw new \LogicException('Invalid stored synchronization result.', 0, $exception);
			}
		}

		$this->connection->beginTransaction();
		try {
			$result = $this->applyMutation($uid, $mutation);
			$operation = new SyncOperation();
			$operation->setUid($uid);
			$operation->setInstallationId($installationId);
			$operation->setOperationId($mutation['operationId']);
			$operation->setResultJson(json_encode($result, JSON_THROW_ON_ERROR));
			$operation->setCreatedAt($this->clock->nowUtc());
			$this->operationMapper->create($operation);
			$this->connection->commit();
			return $result;
		} catch (\Throwable $exception) {
			$this->connection->rollBack();
			throw $exception;
		}
	}

	/** @param SyncMutation $mutation @return array<string, mixed> */
	private function applyMutation(string $uid, array $mutation): array {
		$type = $mutation['type'];
		$clientUid = $mutation['clientUid'];
		$baseRevision = $mutation['baseRevision'];
		$localEntry = $mutation['entry'] ?? null;

		try {
			$current = $this->entryService->findByClientUid($uid, $clientUid);
		} catch (EntryNotFoundException) {
			$current = null;
		}

		if ($type === 'create') {
			if ($current !== null) {
				return $this->conflict($mutation, $current, $localEntry, 'already_exists');
			}
			if (!is_array($localEntry)) {
				throw new ValidationException('A create mutation requires entry data.');
			}
			$created = $this->entryService->createForSync(
				$uid,
				$clientUid,
				$localEntry['text'] ?? null,
				$localEntry['type'] ?? null,
				$localEntry['important'] ?? null,
				$localEntry['contextId'] ?? null,
				$localEntry['referenceType'] ?? null,
				$localEntry['targetDate'] ?? null,
				$localEntry['status'] ?? 'open',
			);
			return ['acknowledged' => true, 'change' => $created];
		}

		if ($current === null) {
			$revision = $this->changeMapper->latestRevisionForClient($uid, $clientUid) ?? max(1, $baseRevision + 1);
			if ($type === 'delete') {
				return ['acknowledged' => true, 'deletion' => ['clientUid' => $clientUid, 'revision' => $revision]];
			}
			return $this->conflict($mutation, null, $localEntry, 'deleted_on_server', $revision);
		}

		if ($current->getRevision() !== $baseRevision || !$this->entryMapper->claimRevisionForUser($current->getId(), $uid, $baseRevision)) {
			$current = $this->entryService->findByClientUid($uid, $clientUid);
			return $this->conflict($mutation, $current, $localEntry, 'revision_mismatch');
		}

		if ($type === 'delete') {
			$this->entryService->delete($uid, $current->getId(), true);
			return ['acknowledged' => true, 'deletion' => ['clientUid' => $clientUid, 'revision' => $baseRevision + 1]];
		}
		if (!is_array($localEntry)) {
			throw new ValidationException('An update mutation requires entry data.');
		}
		$updated = $this->entryService->updateForSync(
			$uid,
			$current->getId(),
			$localEntry['text'] ?? null,
			$localEntry['type'] ?? null,
			$localEntry['important'] ?? null,
			$localEntry['contextId'] ?? null,
			$localEntry['referenceType'] ?? null,
			$localEntry['targetDate'] ?? null,
			$localEntry['status'] ?? null,
			true,
		);
		return ['acknowledged' => true, 'change' => $updated];
	}

	/** @param SyncMutation $mutation @param array<string, mixed>|null $localEntry @return array<string, mixed> */
	private function conflict(array $mutation, ?Entry $current, ?array $localEntry, string $reason, ?int $revision = null): array {
		$serverEntry = null;
		if ($current !== null) {
			$serverEntry = $this->entryService->toSyncResponse($current, $this->contextService->find($current->getUid(), $current->getContextId()));
			$revision = $current->getRevision();
		}
		return ['acknowledged' => false, 'conflict' => [
			'operationId' => $mutation['operationId'],
			'clientUid' => $mutation['clientUid'],
			'baseRevision' => $mutation['baseRevision'],
			'serverRevision' => $revision ?? 0,
			'reason' => $reason,
			'mutationType' => $mutation['type'],
			'localEntry' => $localEntry,
			'serverEntry' => $serverEntry,
		]];
	}

	/** @return array{changes: list<array<string, mixed>>, deletions: list<array<string, mixed>>, nextCursor: int, hasMore: bool} */
	private function pull(string $uid, ?int $cursor): array {
		if ($cursor === null) {
			$entries = array_map(fn (Entry $entry): array => $this->entryService->toSyncResponse($entry, $this->contextService->find($uid, $entry->getContextId())), $this->entryMapper->findAllForUser($uid));
			return ['changes' => $entries, 'deletions' => [], 'nextCursor' => $this->changeMapper->latestCursorForUser($uid), 'hasMore' => false];
		}

		$events = $this->changeMapper->findAfterForUser($cursor, $uid, self::PULL_LIMIT + 1);
		$hasMore = count($events) > self::PULL_LIMIT;
		$events = array_slice($events, 0, self::PULL_LIMIT);
		$latest = [];
		foreach ($events as $event) {
			$latest[$event->getClientUid()] = $event;
		}
		$changes = [];
		$deletions = [];
		foreach ($latest as $event) {
			if ($event->getOperation() === 'delete') {
				$deletions[] = ['clientUid' => $event->getClientUid(), 'revision' => $event->getRevision()];
				continue;
			}
			try {
				$entry = $this->entryService->findByClientUid($uid, $event->getClientUid());
				$changes[] = $this->entryService->toSyncResponse($entry, $this->contextService->find($uid, $entry->getContextId()));
			} catch (EntryNotFoundException) {
				$deletions[] = ['clientUid' => $event->getClientUid(), 'revision' => $event->getRevision()];
			}
		}
		$nextCursor = $events === [] ? $cursor : $events[array_key_last($events)]->getId();
		return ['changes' => $changes, 'deletions' => $deletions, 'nextCursor' => $nextCursor, 'hasMore' => $hasMore];
	}

	/** @param list<array<string, mixed>> $items @return list<array<string, mixed>> */
	private function deduplicate(array $items, string $key): array {
		/** @var array<string, array<string, mixed>> $result */
		$result = [];
		foreach ($items as $item) {
			if (isset($item[$key]) && is_string($item[$key])) {
				$result[$item[$key]] = $item;
			}
		}
		return array_values($result);
	}

	/** @return list<SyncMutation> */
	private function mutations(mixed $mutations): array {
		if (!is_array($mutations) || !array_is_list($mutations) || count($mutations) > self::MAX_MUTATIONS) {
			throw new ValidationException('Mutations must be a list containing at most 100 operations.');
		}
		$result = [];
		foreach ($mutations as $mutation) {
			if (!is_array($mutation)) {
				throw new ValidationException('Invalid synchronization mutation.');
			}
			$type = $mutation['type'] ?? null;
			if (!is_string($type) || !in_array($type, ['create', 'update', 'delete'], true)) {
				throw new ValidationException('Invalid synchronization mutation type.');
			}
			$baseRevision = $mutation['baseRevision'] ?? null;
			if (!is_int($baseRevision) || $baseRevision < 0 || ($type === 'create' && $baseRevision !== 0) || ($type !== 'create' && $baseRevision < 1)) {
				throw new ValidationException('Invalid synchronization base revision.');
			}
			$entry = $mutation['entry'] ?? null;
			if ($entry !== null && !is_array($entry)) {
				throw new ValidationException('Invalid synchronization entry data.');
			}
			/** @var array<string, mixed>|null $entry */
			$result[] = [
				'type' => $type,
				'operationId' => $this->uuid($mutation['operationId'] ?? null, 'operation'),
				'clientUid' => $this->uuid($mutation['clientUid'] ?? null, 'entry'),
				'baseRevision' => $baseRevision,
				'entry' => $entry,
			];
		}
		return $result;
	}

	private function cursor(mixed $cursor): ?int {
		if ($cursor === null || $cursor === '') {
			return null;
		}
		if (is_string($cursor) && preg_match('/^[0-9]+$/D', $cursor) === 1) {
			$cursor = (int)$cursor;
		}
		if (!is_int($cursor) || $cursor < 0) {
			throw new ValidationException('Invalid synchronization cursor.');
		}
		return $cursor;
	}

	private function uuid(mixed $value, string $name): string {
		if (!is_string($value) || preg_match(self::UUID_PATTERN, $value) !== 1) {
			throw new ValidationException('Invalid ' . $name . ' identifier.');
		}
		return strtolower($value);
	}
}
