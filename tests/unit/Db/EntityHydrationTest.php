<?php

declare(strict_types=1);

namespace Db;

use OCA\Taskbook\Db\Context;
use OCA\Taskbook\Db\Entry;
use PHPUnit\Framework\TestCase;

final class EntityHydrationTest extends TestCase {
	public function testEntryHydratesInternalSyncColumnsWithoutChangingTheNormalDto(): void {
		$entry = Entry::fromRow([
			'id' => 3,
			'uid' => 'alice',
			'client_uid' => 'f02e095c-4bc4-4a0b-bd56-442e1141387e',
			'revision' => '2',
			'text' => 'Private task',
		]);

		self::assertSame('f02e095c-4bc4-4a0b-bd56-442e1141387e', $entry->getClientUid());
		self::assertSame(2, $entry->getRevision());
	}

	public function testContextHydratesInternalRevisionColumn(): void {
		$context = Context::fromRow([
			'id' => 6,
			'uid' => 'alice',
			'revision' => '4',
			'title' => 'General',
		]);

		self::assertSame(4, $context->getRevision());
	}
}
