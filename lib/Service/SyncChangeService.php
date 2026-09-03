<?php

declare(strict_types=1);

namespace OCA\Taskbook\Service;

use OCA\Taskbook\Db\Entry;
use OCA\Taskbook\Db\SyncChange;
use OCA\Taskbook\Db\SyncChangeMapper;

class SyncChangeService {
	/** @psalm-suppress PossiblyUnusedMethod Instantiated by Nextcloud dependency injection. */
	public function __construct(
		private SyncChangeMapper $changeMapper,
		private Clock $clock,
	) {
	}

	public function entryUpsert(Entry $entry): void {
		$this->record($entry->getUid(), $entry->getClientUid(), $entry->getId(), 'upsert', $entry->getRevision());
	}

	public function entryDelete(string $uid, string $clientUid, int $serverId, int $revision): void {
		$this->record($uid, $clientUid, $serverId, 'delete', $revision);
	}

	private function record(string $uid, string $clientUid, int $serverId, string $operation, int $revision): void {
		$change = new SyncChange();
		$change->setUid($uid);
		$change->setEntityType('entry');
		$change->setClientUid($clientUid);
		$change->setServerId($serverId);
		$change->setOperation($operation);
		$change->setRevision($revision);
		$change->setCreatedAt($this->clock->nowUtc());
		$this->changeMapper->create($change);
	}
}
