<?php

declare(strict_types=1);

namespace OCA\Taskbook\Db;

use OCP\AppFramework\Db\DoesNotExistException;
use OCP\AppFramework\Db\MultipleObjectsReturnedException;
use OCP\AppFramework\Db\QBMapper;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\IDBConnection;

/** @extends QBMapper<Context> */
class ContextMapper extends QBMapper {
	/** @psalm-suppress PossiblyUnusedMethod Instantiated by Nextcloud dependency injection. */
	public function __construct(IDBConnection $db) {
		parent::__construct($db, 'taskbook_contexts', Context::class);
	}

	public function create(Context $context): Context {
		return $this->insert($context);
	}

	/** @throws DoesNotExistException|MultipleObjectsReturnedException */
	public function findForUser(int $id, string $uid): Context {
		$qb = $this->db->getQueryBuilder();
		$qb->select('*')->from($this->tableName)
			->where($qb->expr()->eq('id', $qb->createNamedParameter($id, IQueryBuilder::PARAM_INT)))
			->andWhere($qb->expr()->eq('uid', $qb->createNamedParameter($uid, IQueryBuilder::PARAM_STR)));

		return $this->findEntity($qb);
	}

	/** @return list<Context> */
	public function findAllForUser(string $uid): array {
		$qb = $this->db->getQueryBuilder();
		$qb->select('*')->from($this->tableName)
			->where($qb->expr()->eq('uid', $qb->createNamedParameter($uid, IQueryBuilder::PARAM_STR)))
			->orderBy('created_at', 'ASC')->addOrderBy('id', 'ASC');

		return $this->findEntities($qb);
	}

	public function findByAliasForUser(string $alias, string $uid, ?int $excludeId = null): ?Context {
		$qb = $this->db->getQueryBuilder();
		$qb->select('*')->from($this->tableName)
			->where($qb->expr()->eq('alias', $qb->createNamedParameter($alias, IQueryBuilder::PARAM_STR)))
			->andWhere($qb->expr()->eq('uid', $qb->createNamedParameter($uid, IQueryBuilder::PARAM_STR)));
		if ($excludeId !== null) {
			$qb->andWhere($qb->expr()->neq('id', $qb->createNamedParameter($excludeId, IQueryBuilder::PARAM_INT)));
		}

		try {
			return $this->findEntity($qb);
		} catch (DoesNotExistException) {
			return null;
		}
	}

	public function updateForUser(Context $context, string $uid): Context {
		if ($context->getUid() !== $uid) {
			throw new \InvalidArgumentException('Context ownership does not match the authenticated user.');
		}

		$qb = $this->db->getQueryBuilder();
		$qb->update($this->tableName)
			->set('revision', $qb->createNamedParameter($context->getRevision(), IQueryBuilder::PARAM_INT))
			->set('title', $qb->createNamedParameter($context->getTitle(), IQueryBuilder::PARAM_STR))
			->set('icon', $qb->createNamedParameter($context->getIcon(), IQueryBuilder::PARAM_STR))
			->set('alias', $qb->createNamedParameter($context->getAlias(), IQueryBuilder::PARAM_STR))
			->set('updated_at', $qb->createNamedParameter($context->getUpdatedAt(), IQueryBuilder::PARAM_DATETIME_IMMUTABLE))
			->where($qb->expr()->eq('id', $qb->createNamedParameter($context->getId(), IQueryBuilder::PARAM_INT)))
			->andWhere($qb->expr()->eq('uid', $qb->createNamedParameter($uid, IQueryBuilder::PARAM_STR)))
			->executeStatement();

		return $context;
	}

	public function deleteForUser(int $id, string $uid): void {
		$qb = $this->db->getQueryBuilder();
		$qb->delete($this->tableName)
			->where($qb->expr()->eq('id', $qb->createNamedParameter($id, IQueryBuilder::PARAM_INT)))
			->andWhere($qb->expr()->eq('uid', $qb->createNamedParameter($uid, IQueryBuilder::PARAM_STR)))
			->executeStatement();
	}
}
