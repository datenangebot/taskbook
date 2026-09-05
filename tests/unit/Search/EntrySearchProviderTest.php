<?php

declare(strict_types=1);

namespace Search;

use DateTimeImmutable;
use OCA\Taskbook\AppInfo\Application;
use OCA\Taskbook\Db\Entry;
use OCA\Taskbook\Db\EntryMapper;
use OCA\Taskbook\Search\EntrySearchProvider;
use OCA\Taskbook\Service\EntryService;
use OCP\AppFramework\Bootstrap\IRegistrationContext;
use OCP\IL10N;
use OCP\IURLGenerator;
use OCP\IUser;
use OCP\Search\ISearchQuery;
use PHPUnit\Framework\TestCase;

final class EntrySearchProviderTest extends TestCase {
	public function testRegistersTheNativeSearchProvider(): void {
		$context = $this->createMock(IRegistrationContext::class);
		$context->expects(self::once())->method('registerSearchProvider')->with(EntrySearchProvider::class);
		$context->method('registerDashboardWidget');
		$context->method('registerNotifierService');
		(new Application())->register($context);
	}

	public function testSearchUsesTheAuthenticatedUserTermLimitAndOffset(): void {
		$mapper = $this->createMock(EntryMapper::class);
		$mapper->expects(self::once())->method('searchByTextForUser')->with('alice', 'monthly', 3, 2)->willReturn([$this->entry(8, 'Prepare monthly report')]);
		$provider = $this->provider($mapper, ['2026-09-04']);

		$result = $provider->search($this->user('alice'), $this->query(' monthly ', 2, '2'))->jsonSerialize();

		self::assertSame('taskbook-entries', $provider->getId());
		self::assertSame('Taskbook', $result['name']);
		self::assertFalse($result['isPaginated']);
		$entry = $result['entries'][0]->jsonSerialize();
		self::assertSame('Prepare monthly report', $entry['title']);
		self::assertSame('· Task · Open', $entry['subline']);
		self::assertSame('/apps/taskbook/img/app.svg', $entry['thumbnailUrl']);
		self::assertSame('https://cloud.test/index.php/apps/taskbook/day/2026-09-04', $entry['resourceUrl']);
	}

	public function testSearchPaginatesDeterministicallyAndUsesLatestMigratedDate(): void {
		$mapper = $this->createMock(EntryMapper::class);
		$mapper->expects(self::once())->method('searchByTextForUser')->with('alice', 'report', 3, 0)->willReturn([
			$this->entry(3, 'Newest report', 'migrated_task'), $this->entry(2, 'Older report'), $this->entry(1, 'Another report'),
		]);
		$provider = $this->provider($mapper, ['2026-09-04', '2026-09-01']);

		$result = $provider->search($this->user('alice'), $this->query('report', 2))->jsonSerialize();

		self::assertTrue($result['isPaginated']);
		self::assertSame(2, $result['cursor']);
		self::assertCount(2, $result['entries']);
		$entry = $result['entries'][0]->jsonSerialize();
		self::assertSame('> Migrated task · Open', $entry['subline']);
		self::assertStringEndsWith('/day/2026-09-04', $entry['resourceUrl']);
	}

	public function testWhitespaceQueryNeverSearches(): void {
		$mapper = $this->createMock(EntryMapper::class);
		$mapper->expects(self::never())->method('searchByTextForUser');
		$provider = $this->provider($mapper, ['2026-09-04']);
		self::assertSame([], $provider->search($this->user('alice'), $this->query('  ', 10))->jsonSerialize()['entries']);
	}

	public function testCompletedEntriesRetainTheirTarget(): void {
		$mapper = $this->createMock(EntryMapper::class);
		$entry = $this->entry(2, 'Completed report', 'migrated_task');
		$entry->setStatus('completed');
		$mapper->expects(self::once())->method('searchByTextForUser')->willReturn([$entry]);
		$provider = $this->provider($mapper, ['2026-09-04']);
		$result = $provider->search($this->user('alice'), $this->query('report', 10))->jsonSerialize()['entries'][0]->jsonSerialize();
		self::assertSame('> Migrated task · Completed', $result['subline']);
		self::assertStringEndsWith('/day/2026-09-04', $result['resourceUrl']);
	}

	public function testUndatedFutureEntriesAreSearchable(): void {
		$mapper = $this->createMock(EntryMapper::class);
		$future = $this->entry(4, 'Future report');
		$future->setReferenceType('none');
		$mapper->expects(self::once())->method('searchByTextForUser')->with('alice', 'future', 11, 0)->willReturn([$future]);
		$provider = $this->provider($mapper, [null]);

		$result = $provider->search($this->user('alice'), $this->query('future', 10))->jsonSerialize()['entries'][0]->jsonSerialize();

		self::assertStringEndsWith('/future', $result['resourceUrl']);
	}

	/** @param list<string|null> $dates */
	private function provider(EntryMapper $mapper, array $dates): EntrySearchProvider {
		$entries = $this->createMock(EntryService::class);
		$entries->method('effectiveTargetDate')->willReturnCallback(static function () use (&$dates): ?DateTimeImmutable {
			$date = array_shift($dates);
			return $date === null ? null : new DateTimeImmutable($date);
		});
		$l10n = $this->createMock(IL10N::class);
		$l10n->method('t')->willReturnCallback(static fn (string $text): string => $text);
		$urls = $this->createMock(IURLGenerator::class);
		$urls->method('imagePath')->with('taskbook', 'app.svg')->willReturn('/apps/taskbook/img/app.svg');
		$urls->method('linkToRoute')->willReturnCallback(static fn (string $route, array $parameters): string => '/index.php/apps/taskbook/' . ($parameters['path'] ?? ''));
		$urls->method('getAbsoluteURL')->willReturnCallback(static fn (string $url): string => 'https://cloud.test' . $url);
		return new EntrySearchProvider($mapper, $entries, $l10n, $urls);
	}

	private function user(string $uid): IUser {
		$user = $this->createMock(IUser::class);
		$user->method('getUID')->willReturn($uid);
		return $user;
	}

	private function query(string $term, int $limit, int|string|null $cursor = null): ISearchQuery {
		$query = $this->createMock(ISearchQuery::class);
		$query->method('getTerm')->willReturn($term);
		$query->method('getLimit')->willReturn($limit);
		$query->method('getCursor')->willReturn($cursor);
		return $query;
	}

	private function entry(int $id, string $text, string $type = 'task'): Entry {
		$entry = new Entry();
		$entry->setId($id);
		$entry->setText($text);
		$entry->setType($type);
		$entry->setStatus('open');
		return $entry;
	}
}
