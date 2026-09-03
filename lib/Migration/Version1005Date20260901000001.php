<?php

declare(strict_types=1);

namespace OCA\Taskbook\Migration;

use Closure;
use OCP\DB\ISchemaWrapper;
use OCP\Migration\IOutput;
use OCP\Migration\SimpleMigrationStep;

/**
 * Makes the stable Entry synchronization identity mandatory after 1004 has
 * populated every existing row.
 *
 * @psalm-suppress UnusedClass Migrations are discovered by Nextcloud.
 * @psalm-suppress UndefinedDocblockClass Nextcloud's schema wrapper references Doctrine types not shipped to Psalm.
 */
class Version1005Date20260901000001 extends SimpleMigrationStep {
	public function changeSchema(IOutput $output, Closure $schemaClosure, array $options): ?ISchemaWrapper {
		$schema = $schemaClosure();
		if (!$schema->hasTable('taskbook_entries')) {
			return null;
		}
		$table = $schema->getTable('taskbook_entries');
		if (!$table->hasColumn('client_uid')) {
			return null;
		}
		/** @psalm-suppress MixedMethodCall Doctrine's column interface is absent from the lightweight OCP analysis package. */
		$table->getColumn('client_uid')->setNotnull(true);
		return $schema;
	}
}
