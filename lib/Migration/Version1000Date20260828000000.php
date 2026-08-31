<?php

declare(strict_types=1);

namespace OCA\Taskbook\Migration;

use Closure;
use OCP\DB\ISchemaWrapper;
use OCP\DB\Types;
use OCP\Migration\IOutput;
use OCP\Migration\SimpleMigrationStep;

/**
 * @psalm-suppress UnusedClass Migrations are discovered by Nextcloud.
 * @psalm-suppress UndefinedDocblockClass Nextcloud's schema wrapper references Doctrine types not shipped to Psalm.
 */
class Version1000Date20260828000000 extends SimpleMigrationStep {
	public function changeSchema(IOutput $output, Closure $schemaClosure, array $options): ?ISchemaWrapper {
		$schema = $schemaClosure();
		if ($schema->hasTable('taskbook_contexts') || $schema->hasTable('taskbook_entries')) {
			return null;
		}

		$contexts = $schema->createTable('taskbook_contexts');
		$contexts->addColumn('id', Types::BIGINT, ['autoincrement' => true, 'notnull' => true, 'unsigned' => true]);
		$contexts->addColumn('uid', Types::STRING, ['length' => 64, 'notnull' => true]);
		$contexts->addColumn('title', Types::STRING, ['length' => 255, 'notnull' => true]);
		$contexts->addColumn('icon', Types::STRING, ['length' => 64, 'notnull' => true]);
		$contexts->addColumn('created_at', Types::DATETIME_IMMUTABLE, ['notnull' => true]);
		$contexts->addColumn('updated_at', Types::DATETIME_IMMUTABLE, ['notnull' => true]);
		$contexts->setPrimaryKey(['id']);
		$contexts->addIndex(['uid', 'created_at', 'id'], 'taskbook_ctx_uid_created_idx');

		$entries = $schema->createTable('taskbook_entries');
		$entries->addColumn('id', Types::BIGINT, ['autoincrement' => true, 'notnull' => true, 'unsigned' => true]);
		$entries->addColumn('uid', Types::STRING, ['length' => 64, 'notnull' => true]);
		$entries->addColumn('text', Types::TEXT, ['notnull' => true]);
		$entries->addColumn('type', Types::STRING, ['length' => 32, 'notnull' => true]);
		$entries->addColumn('important', Types::BOOLEAN, ['notnull' => true, 'default' => false]);
		$entries->addColumn('context_id', Types::BIGINT, ['notnull' => true, 'unsigned' => true]);
		$entries->addColumn('reference_type', Types::STRING, ['length' => 16, 'notnull' => true]);
		$entries->addColumn('primary_target_date', Types::DATE_IMMUTABLE, ['notnull' => false]);
		$entries->addColumn('secondary_target_date', Types::DATE_IMMUTABLE, ['notnull' => false]);
		$entries->addColumn('status', Types::STRING, ['length' => 16, 'notnull' => true]);
		$entries->addColumn('completed_at', Types::DATETIME_IMMUTABLE, ['notnull' => false]);
		$entries->addColumn('created_at', Types::DATETIME_IMMUTABLE, ['notnull' => true]);
		$entries->addColumn('updated_at', Types::DATETIME_IMMUTABLE, ['notnull' => true]);
		$entries->setPrimaryKey(['id']);
		$entries->addIndex(['uid', 'status', 'reference_type', 'primary_target_date'], 'taskbook_ent_usr_stat_ref_pri_idx');
		$entries->addIndex(['uid', 'context_id'], 'taskbook_ent_uid_context_idx');
		$entries->addIndex(['uid', 'created_at', 'id'], 'taskbook_ent_uid_created_idx');

		return $schema;
	}
}
