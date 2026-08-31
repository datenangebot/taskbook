<?php

declare(strict_types=1);

namespace OCA\Taskbook\Migration;

use Closure;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\IDBConnection;
use OCP\Migration\IOutput;
use OCP\Migration\SimpleMigrationStep;

/**
 * Converts legacy Context SVG identifiers to their emoji equivalents.
 *
 * @psalm-suppress UnusedClass Migrations are discovered by Nextcloud.
 */
class Version1001Date20260829000000 extends SimpleMigrationStep {
	/** @var array<string, string> */
	private const LEGACY_ICONS = [
		'account' => '👤',
		'book-open-variant' => '📖',
		'briefcase' => '💼',
		'calendar' => '📅',
		'folder' => '🗂️',
		'home' => '🏠',
		'lightbulb' => '💡',
		'star' => '⭐',
		'tag' => '🏷️',
		'wallet' => '💰',
	];

	public function __construct(
		private IDBConnection $connection,
	) {
	}

	public function postSchemaChange(IOutput $output, Closure $schemaClosure, array $options): void {
		foreach (self::LEGACY_ICONS as $legacy => $emoji) {
			$qb = $this->connection->getQueryBuilder();
			$qb->update('taskbook_contexts')
				->set('icon', $qb->createNamedParameter($emoji, IQueryBuilder::PARAM_STR))
				->where($qb->expr()->eq('icon', $qb->createNamedParameter($legacy, IQueryBuilder::PARAM_STR)))
				->executeStatement();
		}
	}
}
