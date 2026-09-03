<?php

declare(strict_types=1);

namespace Db;

use OCA\Taskbook\Db\Context;
use OCA\Taskbook\Db\Entry;
use OCA\Taskbook\Db\SyncChange;
use PHPUnit\Framework\TestCase;

final class RevisionPersistenceTest extends TestCase {
	public function testNewEntitiesMarkTheirInitialRevisionForInsertion(): void {
		$entry = new Entry();
		$context = new Context();
		$change = new SyncChange();

		$entry->setRevision(1);
		$context->setRevision(1);
		$change->setRevision(1);

		self::assertArrayHasKey('revision', $entry->getUpdatedFields());
		self::assertArrayHasKey('revision', $context->getUpdatedFields());
		self::assertArrayHasKey('revision', $change->getUpdatedFields());
	}
}
