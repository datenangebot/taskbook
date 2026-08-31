<?php

declare(strict_types=1);

namespace OCA\Taskbook\Migration;

use Closure;
use OCP\DB\ISchemaWrapper;
use OCP\Migration\IOutput;
use OCP\Migration\SimpleMigrationStep;

/**
 * @psalm-suppress UnusedClass Migrations are discovered by Nextcloud.
 * @psalm-suppress UndefinedDocblockClass Nextcloud's schema wrapper references Doctrine types not shipped to Psalm.
 */
class Version1003Date20260831000001 extends SimpleMigrationStep {
	public function changeSchema(IOutput $output, Closure $schemaClosure, array $options): ?ISchemaWrapper {
		$schema = $schemaClosure();
		if (!$schema->hasTable('taskbook_contexts')) {
			return null;
		}

		$contexts = $schema->getTable('taskbook_contexts');
		if (!$contexts->hasUniqueConstraint('taskbook_ctx_uid_alias_uniq') && !$contexts->hasIndex('taskbook_ctx_uid_alias_idx')) {
			$contexts->addUniqueIndex(['uid', 'alias'], 'taskbook_ctx_uid_alias_idx');
		}

		return $schema;
	}
}
