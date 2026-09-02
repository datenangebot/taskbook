<?php

declare(strict_types=1);

namespace OCA\Taskbook\Db;

use OCP\AppFramework\Db\DoesNotExistException;
use OCP\AppFramework\Db\MultipleObjectsReturnedException;
use OCP\AppFramework\Db\QBMapper;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\IDBConnection;

/** @extends QBMapper<SyncOperation> */
class SyncOperationMapper extends QBMapper {
	/** @psalm-suppress PossiblyUnusedMethod Instantiated by Nextcloud dependency injection. */
	public function __construct(IDBConnection $db) {
		parent::__construct($db, 'taskbook_sync_ops', SyncOperation::class);
	}

	public function create(SyncOperation $operation): void {
		$this->insert($operation);
	}

	public function findForUser(string $operationId, string $uid): ?SyncOperation {
		$qb = $this->db->getQueryBuilder();
		$qb->select('*')->from($this->tableName)
			->where($qb->expr()->eq('operation_id', $qb->createNamedParameter($operationId, IQueryBuilder::PARAM_STR)))
			->andWhere($qb->expr()->eq('uid', $qb->createNamedParameter($uid, IQueryBuilder::PARAM_STR)));
		try {
			return $this->findEntity($qb);
		} catch (DoesNotExistException) {
			return null;
		} catch (MultipleObjectsReturnedException $exception) {
			throw new \LogicException('Duplicate synchronization operation.', 0, $exception);
		}
	}
}
