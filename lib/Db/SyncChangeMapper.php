<?php

declare(strict_types=1);

namespace OCA\Taskbook\Db;

use OCP\AppFramework\Db\QBMapper;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\IDBConnection;

/** @extends QBMapper<SyncChange> */
class SyncChangeMapper extends QBMapper {
	/** @psalm-suppress PossiblyUnusedMethod Instantiated by Nextcloud dependency injection. */
	public function __construct(IDBConnection $db) {
		parent::__construct($db, 'taskbook_sync_changes', SyncChange::class);
	}

	public function create(SyncChange $change): void {
		$this->insert($change);
	}

	/** @return list<SyncChange> */
	public function findAfterForUser(int $cursor, string $uid, int $limit): array {
		$qb = $this->db->getQueryBuilder();
		$qb->select('*')->from($this->tableName)
			->where($qb->expr()->eq('uid', $qb->createNamedParameter($uid, IQueryBuilder::PARAM_STR)))
			->andWhere($qb->expr()->gt('id', $qb->createNamedParameter($cursor, IQueryBuilder::PARAM_INT)))
			->orderBy('id', 'ASC')
			->setMaxResults($limit);
		return $this->findEntities($qb);
	}

	public function latestCursorForUser(string $uid): int {
		$qb = $this->db->getQueryBuilder();
		$qb->selectAlias($qb->func()->max('id'), 'cursor')->from($this->tableName)
			->where($qb->expr()->eq('uid', $qb->createNamedParameter($uid, IQueryBuilder::PARAM_STR)));
		$result = $qb->executeQuery();
		/** @psalm-suppress MixedAssignment Database abstraction has no row-shape generic. */
		$row = $result->fetch();
		$result->closeCursor();
		return is_array($row) ? (int)($row['cursor'] ?? 0) : 0;
	}

	public function latestRevisionForClient(string $uid, string $clientUid): ?int {
		$qb = $this->db->getQueryBuilder();
		$qb->select('revision')->from($this->tableName)
			->where($qb->expr()->eq('uid', $qb->createNamedParameter($uid, IQueryBuilder::PARAM_STR)))
			->andWhere($qb->expr()->eq('client_uid', $qb->createNamedParameter($clientUid, IQueryBuilder::PARAM_STR)))
			->orderBy('id', 'DESC')->setMaxResults(1);
		$result = $qb->executeQuery();
		/** @psalm-suppress MixedAssignment Database abstraction has no scalar generic. */
		$value = $result->fetchOne();
		$result->closeCursor();
		return $value === false ? null : (int)$value;
	}
}
