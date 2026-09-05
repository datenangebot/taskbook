<?php

declare(strict_types=1);

namespace OCA\Taskbook\Search;

use OCA\Taskbook\AppInfo\Application;
use OCA\Taskbook\Db\Entry;
use OCA\Taskbook\Db\EntryMapper;
use OCA\Taskbook\Service\EntryService;
use OCP\IL10N;
use OCP\IURLGenerator;
use OCP\IUser;
use OCP\Search\IProvider;
use OCP\Search\ISearchQuery;
use OCP\Search\SearchResult;
use OCP\Search\SearchResultEntry;

/** Native Unified Search provider for the authenticated user's Taskbook entries. */
class EntrySearchProvider implements IProvider {
	private const PROVIDER_ID = 'taskbook-entries';
	private const MAX_LIMIT = 100;

	/** @psalm-suppress PossiblyUnusedMethod Registered by the Taskbook bootstrap. */
	public function __construct(
		private EntryMapper $entryMapper,
		private EntryService $entryService,
		private IL10N $l10n,
		private IURLGenerator $urlGenerator,
	) {
	}

	#[\Override]
	public function getId(): string {
		return self::PROVIDER_ID;
	}

	#[\Override]
	public function getName(): string {
		return $this->l10n->t('Taskbook');
	}

	#[\Override]
	public function getOrder(string $route, array $routeParameters): int {
		return 30;
	}

	#[\Override]
	public function search(IUser $user, ISearchQuery $query): SearchResult {
		$term = trim($query->getTerm());
		if ($term === '') {
			return SearchResult::complete($this->getName(), []);
		}

		$limit = max(1, min(self::MAX_LIMIT, $query->getLimit()));
		$offset = $this->offset($query->getCursor());
		$entries = $this->entryMapper->searchByTextForUser($user->getUID(), $term, $limit + 1, $offset);
		$hasMore = count($entries) > $limit;
		$entries = array_slice($entries, 0, $limit);
		$results = array_map(fn (Entry $entry): SearchResultEntry => $this->result($entry), $entries);

		return $hasMore
			? SearchResult::paginated($this->getName(), $results, $offset + count($entries))
			: SearchResult::complete($this->getName(), $results);
	}

	private function result(Entry $entry): SearchResultEntry {
		$date = $this->entryService->effectiveTargetDate($entry)?->format('Y-m-d');
		$icon = $this->urlGenerator->imagePath(Application::APP_ID, 'app.svg');
		$path = $date === null ? 'future' : 'day/' . $date;
		$url = $this->urlGenerator->getAbsoluteURL($this->urlGenerator->linkToRoute('taskbook.page.deepLink', ['path' => $path]));
		return new SearchResultEntry($icon, $entry->getText(), $this->subline($entry), $url, $icon, false);
	}

	private function subline(Entry $entry): string {
		$type = match ($entry->getType()) {
			'task' => ['·', $this->l10n->t('Task')],
			'appointment' => ['○', $this->l10n->t('Appointment')],
			'note' => ['-', $this->l10n->t('Note')],
			'migrated_task' => ['>', $this->l10n->t('Migrated task')],
			'irrelevant_task' => ['(·)', $this->l10n->t('Irrelevant task')],
			default => ['', $this->l10n->t('Task')],
		};
		$status = $entry->getStatus() === 'completed' ? $this->l10n->t('Completed') : $this->l10n->t('Open');
		return trim($type[0] . ' ' . $type[1]) . ' · ' . $status;
	}

	private function offset(int|string|null $cursor): int {
		if (is_int($cursor)) {
			return max(0, $cursor);
		}
		return is_string($cursor) && ctype_digit($cursor) ? (int)$cursor : 0;
	}
}
