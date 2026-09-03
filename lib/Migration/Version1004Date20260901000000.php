<?php

declare(strict_types=1);

namespace OCA\Taskbook\Migration;

use Closure;
use OCP\DB\ISchemaWrapper;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\DB\Types;
use OCP\IDBConnection;
use OCP\Migration\IOutput;
use OCP\Migration\SimpleMigrationStep;

/**
 * Adds stable synchronization identities, server revisions, a cursor log, and
 * the idempotency ledger used by offline clients.
 *
 * @psalm-suppress UnusedClass Migrations are discovered by Nextcloud.
 * @psalm-suppress UndefinedDocblockClass Nextcloud's schema wrapper references Doctrine types not shipped to Psalm.
 */
class Version1004Date20260901000000 extends SimpleMigrationStep {
	public function __construct(
		private IDBConnection $connection,
	) {
	}

	public function changeSchema(IOutput $output, Closure $schemaClosure, array $options): ?ISchemaWrapper {
		$schema = $schemaClosure();
		if (!$schema->hasTable('taskbook_entries') || !$schema->hasTable('taskbook_contexts')) {
			return null;
		}

		$entries = $schema->getTable('taskbook_entries');
		if (!$entries->hasColumn('client_uid')) {
			$entries->addColumn('client_uid', Types::STRING, ['length' => 36, 'notnull' => false]);
		}
		if (!$entries->hasColumn('revision')) {
			$entries->addColumn('revision', Types::BIGINT, ['notnull' => true, 'unsigned' => true, 'default' => 1]);
		}
		if (!$entries->hasIndex('taskbook_ent_uid_client_idx')) {
			$entries->addUniqueIndex(['uid', 'client_uid'], 'taskbook_ent_uid_client_idx');
		}

		$contexts = $schema->getTable('taskbook_contexts');
		if (!$contexts->hasColumn('revision')) {
			$contexts->addColumn('revision', Types::BIGINT, ['notnull' => true, 'unsigned' => true, 'default' => 1]);
		}

		if (!$schema->hasTable('taskbook_sync_changes')) {
			$changes = $schema->createTable('taskbook_sync_changes');
			$changes->addColumn('id', Types::BIGINT, ['autoincrement' => true, 'notnull' => true, 'unsigned' => true]);
			$changes->addColumn('uid', Types::STRING, ['length' => 64, 'notnull' => true]);
			$changes->addColumn('entity_type', Types::STRING, ['length' => 16, 'notnull' => true]);
			$changes->addColumn('client_uid', Types::STRING, ['length' => 36, 'notnull' => true]);
			$changes->addColumn('server_id', Types::BIGINT, ['notnull' => false, 'unsigned' => true]);
			$changes->addColumn('operation', Types::STRING, ['length' => 8, 'notnull' => true]);
			$changes->addColumn('revision', Types::BIGINT, ['notnull' => true, 'unsigned' => true]);
			$changes->addColumn('created_at', Types::DATETIME_IMMUTABLE, ['notnull' => true]);
			$changes->setPrimaryKey(['id']);
			$changes->addIndex(['uid', 'id'], 'taskbook_sync_change_uid_idx');
			$changes->addIndex(['uid', 'client_uid', 'id'], 'taskbook_sync_change_client_idx');
		}

		if (!$schema->hasTable('taskbook_sync_ops')) {
			$operations = $schema->createTable('taskbook_sync_ops');
			$operations->addColumn('id', Types::BIGINT, ['autoincrement' => true, 'notnull' => true, 'unsigned' => true]);
			$operations->addColumn('uid', Types::STRING, ['length' => 64, 'notnull' => true]);
			$operations->addColumn('installation_id', Types::STRING, ['length' => 36, 'notnull' => true]);
			$operations->addColumn('operation_id', Types::STRING, ['length' => 36, 'notnull' => true]);
			$operations->addColumn('result_json', Types::TEXT, ['notnull' => true]);
			$operations->addColumn('created_at', Types::DATETIME_IMMUTABLE, ['notnull' => true]);
			$operations->setPrimaryKey(['id']);
			$operations->addUniqueIndex(['uid', 'operation_id'], 'taskbook_sync_op_uid_op_idx');
			$operations->addIndex(['uid', 'created_at'], 'taskbook_sync_op_uid_created_idx');
		}

		return $schema;
	}

	public function postSchemaChange(IOutput $output, Closure $schemaClosure, array $options): void {
		$select = $this->connection->getQueryBuilder();
		$select->select('id')->from('taskbook_entries')->where($select->expr()->isNull('client_uid'));
		$result = $select->executeQuery();
		/** @psalm-suppress MixedAssignment Database abstraction has no row-shape generic. */
		while (is_array($row = $result->fetch())) {
			$update = $this->connection->getQueryBuilder();
			$update->update('taskbook_entries')
				->set('client_uid', $update->createNamedParameter($this->uuid(), IQueryBuilder::PARAM_STR))
				->where($update->expr()->eq('id', $update->createNamedParameter((int)$row['id'], IQueryBuilder::PARAM_INT)))
				->executeStatement();
		}
		$result->closeCursor();
	}

	private function uuid(): string {
		$bytes = random_bytes(16);
		$bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
		$bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
		$hex = bin2hex($bytes);
		return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-' . substr($hex, 12, 4) . '-' . substr($hex, 16, 4) . '-' . substr($hex, 20);
	}
}
