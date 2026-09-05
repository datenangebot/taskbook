<?php

declare(strict_types=1);

namespace OCA\Taskbook\Db;

use OCP\AppFramework\Db\DoesNotExistException;
use OCP\AppFramework\Db\MultipleObjectsReturnedException;
use OCP\AppFramework\Db\QBMapper;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\IDBConnection;

/** @extends QBMapper<Entry> */
class EntryMapper extends QBMapper {
	/** @psalm-suppress PossiblyUnusedMethod Instantiated by Nextcloud dependency injection. */
	public function __construct(IDBConnection $db) {
		parent::__construct($db, 'taskbook_entries', Entry::class);
	}

	public function create(Entry $entry): Entry {
		return $this->insert($entry);
	}

	/** @throws DoesNotExistException|MultipleObjectsReturnedException */
	public function findForUser(int $id, string $uid): Entry {
		$qb = $this->db->getQueryBuilder();
		$qb->select('*')->from($this->tableName)
			->where($qb->expr()->eq('id', $qb->createNamedParameter($id, IQueryBuilder::PARAM_INT)))
			->andWhere($qb->expr()->eq('uid', $qb->createNamedParameter($uid, IQueryBuilder::PARAM_STR)));

		return $this->findEntity($qb);
	}

	/** @throws DoesNotExistException|MultipleObjectsReturnedException */
	public function findByClientUidForUser(string $clientUid, string $uid): Entry {
		$qb = $this->db->getQueryBuilder();
		$qb->select('*')->from($this->tableName)
			->where($qb->expr()->eq('client_uid', $qb->createNamedParameter($clientUid, IQueryBuilder::PARAM_STR)))
			->andWhere($qb->expr()->eq('uid', $qb->createNamedParameter($uid, IQueryBuilder::PARAM_STR)));

		return $this->findEntity($qb);
	}

	/** @return list<Entry> */
	public function findAllForUser(string $uid): array {
		$qb = $this->db->getQueryBuilder();
		$qb->select('*')->from($this->tableName)
			->where($qb->expr()->eq('uid', $qb->createNamedParameter($uid, IQueryBuilder::PARAM_STR)))
			->orderBy('created_at', 'ASC')->addOrderBy('id', 'ASC');

		return $this->findEntities($qb);
	}

	/** @return list<Entry> */
	public function searchByTextForUser(string $uid, string $term, int $limit, int $offset): array {
		$qb = $this->db->getQueryBuilder();
		$pattern = '%' . $this->db->escapeLikeParameter($term) . '%';
		$qb->select('*')->from($this->tableName)
			->where($qb->expr()->eq('uid', $qb->createNamedParameter($uid, IQueryBuilder::PARAM_STR)))
			->andWhere($qb->expr()->iLike('text', $qb->createNamedParameter($pattern, IQueryBuilder::PARAM_STR)))
			->orderBy('updated_at', 'DESC')->addOrderBy('id', 'DESC')
			->setMaxResults($limit)->setFirstResult($offset);
		return $this->findEntities($qb);
	}

	/**
	 * Select only owners with an open, dated task that could be overdue. The
	 * exact calendar-period rule remains in OverdueService.
	 *
	 * @return list<string>
	 * @psalm-suppress MixedAssignment IResult::fetchAll() does not expose its selected-column type.
	 */
	public function findPotentiallyOverdueUserIds(): array {
		$qb = $this->db->getQueryBuilder();
		$qb->selectDistinct('uid')->from($this->tableName)
			->where($qb->expr()->eq('status', $qb->createNamedParameter('open', IQueryBuilder::PARAM_STR)))
			->andWhere($qb->expr()->in('type', $qb->createNamedParameter(['task', 'migrated_task'], IQueryBuilder::PARAM_STR_ARRAY)))
			->andWhere($qb->expr()->in('reference_type', $qb->createNamedParameter(['day', 'week', 'month'], IQueryBuilder::PARAM_STR_ARRAY)))
			->andWhere($qb->expr()->orX(
				$qb->expr()->isNotNull('primary_target_date'),
				$qb->expr()->isNotNull('secondary_target_date'),
			));
		$result = $qb->executeQuery();
		/** @var list<mixed> $rows */
		$rows = $result->fetchAll(\PDO::FETCH_COLUMN);
		$userIds = [];
		foreach ($rows as $uid) {
			if (is_string($uid) && $uid !== '') {
				$userIds[] = $uid;
			}
		}
		$result->closeCursor();
		return $userIds;
	}

	public function updateForUser(Entry $entry, string $uid): Entry {
		if ($entry->getUid() !== $uid) {
			throw new \InvalidArgumentException('Entry ownership does not match the authenticated user.');
		}

		$qb = $this->db->getQueryBuilder();
		$qb->update($this->tableName)
			->set('client_uid', $qb->createNamedParameter($entry->getClientUid(), IQueryBuilder::PARAM_STR))
			->set('revision', $qb->createNamedParameter($entry->getRevision(), IQueryBuilder::PARAM_INT))
			->set('text', $qb->createNamedParameter($entry->getText(), IQueryBuilder::PARAM_STR))
			->set('type', $qb->createNamedParameter($entry->getType(), IQueryBuilder::PARAM_STR))
			->set('important', $qb->createNamedParameter($entry->isImportant(), IQueryBuilder::PARAM_BOOL))
			->set('context_id', $qb->createNamedParameter($entry->getContextId(), IQueryBuilder::PARAM_INT))
			->set('reference_type', $qb->createNamedParameter($entry->getReferenceType(), IQueryBuilder::PARAM_STR))
			->set('primary_target_date', $qb->createNamedParameter($entry->getPrimaryTargetDate(), IQueryBuilder::PARAM_DATE_IMMUTABLE))
			->set('secondary_target_date', $qb->createNamedParameter($entry->getSecondaryTargetDate(), IQueryBuilder::PARAM_DATE_IMMUTABLE))
			->set('status', $qb->createNamedParameter($entry->getStatus(), IQueryBuilder::PARAM_STR))
			->set('completed_at', $qb->createNamedParameter($entry->getCompletedAt(), IQueryBuilder::PARAM_DATETIME_IMMUTABLE))
			->set('updated_at', $qb->createNamedParameter($entry->getUpdatedAt(), IQueryBuilder::PARAM_DATETIME_IMMUTABLE))
			->where($qb->expr()->eq('id', $qb->createNamedParameter($entry->getId(), IQueryBuilder::PARAM_INT)))
			->andWhere($qb->expr()->eq('uid', $qb->createNamedParameter($uid, IQueryBuilder::PARAM_STR)))
			->executeStatement();

		return $entry;
	}

	public function claimRevisionForUser(int $id, string $uid, int $baseRevision): bool {
		$qb = $this->db->getQueryBuilder();
		$updated = $qb->update($this->tableName)
			->set('revision', $qb->createFunction('revision + 1'))
			->where($qb->expr()->eq('id', $qb->createNamedParameter($id, IQueryBuilder::PARAM_INT)))
			->andWhere($qb->expr()->eq('uid', $qb->createNamedParameter($uid, IQueryBuilder::PARAM_STR)))
			->andWhere($qb->expr()->eq('revision', $qb->createNamedParameter($baseRevision, IQueryBuilder::PARAM_INT)))
			->executeStatement();
		return $updated === 1;
	}

	public function deleteForUser(int $id, string $uid): void {
		$qb = $this->db->getQueryBuilder();
		$qb->delete($this->tableName)
			->where($qb->expr()->eq('id', $qb->createNamedParameter($id, IQueryBuilder::PARAM_INT)))
			->andWhere($qb->expr()->eq('uid', $qb->createNamedParameter($uid, IQueryBuilder::PARAM_STR)))
			->executeStatement();
	}

	public function countForContextForUser(int $contextId, string $uid): int {
		$qb = $this->db->getQueryBuilder();
		$qb->select($qb->func()->count('*', 'count'))->from($this->tableName)
			->where($qb->expr()->eq('context_id', $qb->createNamedParameter($contextId, IQueryBuilder::PARAM_INT)))
			->andWhere($qb->expr()->eq('uid', $qb->createNamedParameter($uid, IQueryBuilder::PARAM_STR)));
		$result = $qb->executeQuery();
		$row = $result->fetch();
		$result->closeCursor();

		if (!is_array($row)) {
			return 0;
		}
		return (int)($row['count'] ?? 0);
	}
}
