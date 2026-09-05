<?php

declare(strict_types=1);

namespace OCA\Taskbook\Service;

use OCA\Taskbook\AppInfo\Application;
use OCA\Taskbook\Db\Context;
use OCA\Taskbook\Db\ContextMapper;
use OCA\Taskbook\Db\EntryMapper;
use OCA\Taskbook\Exception\ContextNotFoundException;
use OCA\Taskbook\Exception\ValidationException;
use OCA\Taskbook\ResponseDefinitions;
use OCP\AppFramework\Db\DoesNotExistException;
use OCP\AppFramework\Db\MultipleObjectsReturnedException;
use OCP\DB\Exception as DbException;

/** @psalm-import-type TaskbookContext from ResponseDefinitions */
class ContextService {
	private const DEFAULT_CONTEXT_KEY = 'default_context_id';
	private const EMOJI_PATTERN = '/^(?:\\p{Extended_Pictographic}|\\p{Regional_Indicator}|[\\x{FE0F}\\x{200D}\\x{20E3}\\p{Emoji_Modifier}]|[0-9#*])+$/uD';
	private const ALIAS_PATTERN = '/^[\\p{L}\\p{N}_-]{1,16}$/uD';

	/** @psalm-suppress PossiblyUnusedMethod Instantiated by Nextcloud dependency injection. */
	public function __construct(
		private ContextMapper $contextMapper,
		private EntryMapper $entryMapper,
		private UserConfigService $userConfig,
		private Clock $clock,
	) {
	}

	/** @return list<TaskbookContext> */
	public function list(string $uid): array {
		return array_map($this->toResponse(...), $this->ensureDefault($uid));
	}

	/** @return TaskbookContext */
	public function create(string $uid, mixed $title, mixed $icon, mixed $alias): array {
		$this->requireUid($uid);
		$contexts = $this->contextMapper->findAllForUser($uid);
		$validatedAlias = $this->validateAlias($alias);
		$this->requireAvailableAlias($uid, $validatedAlias);
		$context = new Context();
		$context->setUid($uid);
		$context->setRevision(1);
		$context->setTitle($this->validateTitle($title));
		$context->setIcon($this->validateIcon($icon));
		$context->setAlias($validatedAlias);
		$context->setCreatedAt($this->clock->nowUtc());
		$context->setUpdatedAt($this->clock->nowUtc());
		try {
			$context = $this->contextMapper->create($context);
		} catch (DbException $exception) {
			$this->throwAliasConflict($exception);
		}
		if ($contexts === []) {
			$this->userConfig->setString($uid, Application::APP_ID, self::DEFAULT_CONTEXT_KEY, (string)$context->getId());
		}

		return $this->toResponse($context);
	}

	/** @return TaskbookContext */
	public function update(string $uid, int $id, mixed $title, mixed $icon, mixed $alias): array {
		$context = $this->find($uid, $id);
		$validatedAlias = $this->validateAlias($alias);
		$this->requireAvailableAlias($uid, $validatedAlias, $id);
		$context->setTitle($this->validateTitle($title));
		$context->setIcon($this->validateIcon($icon));
		$context->setAlias($validatedAlias);
		$context->setUpdatedAt($this->clock->nowUtc());
		$context->setRevision($context->getRevision() + 1);

		try {
			return $this->toResponse($this->contextMapper->updateForUser($context, $uid));
		} catch (DbException $exception) {
			$this->throwAliasConflict($exception);
		}
	}

	public function delete(string $uid, int $id): void {
		$this->find($uid, $id);
		$contexts = $this->ensureDefault($uid);
		if (count($contexts) === 1) {
			throw new ValidationException('At least one context is required.');
		}
		if ($this->defaultId($uid, $contexts) === $id) {
			throw new ValidationException('Choose another default context before deleting this context.');
		}
		if ($this->entryMapper->countForContextForUser($id, $uid) > 0) {
			throw new ValidationException('This context is still used by entries.');
		}

		$this->contextMapper->deleteForUser($id, $uid);
	}

	/** @return array{defaultContextId: int, contexts: list<TaskbookContext>} */
	public function settings(string $uid): array {
		$contexts = $this->ensureDefault($uid);
		return [
			'defaultContextId' => $this->defaultId($uid, $contexts),
			'contexts' => array_map($this->toResponse(...), $contexts),
		];
	}

	/** @return array{defaultContextId: int, contexts: list<TaskbookContext>} */
	public function setDefault(string $uid, mixed $contextId): array {
		$id = $this->validateId($contextId, 'context');
		$this->find($uid, $id);
		$this->userConfig->setString($uid, Application::APP_ID, self::DEFAULT_CONTEXT_KEY, (string)$id);

		return $this->settings($uid);
	}

	public function find(string $uid, int $id): Context {
		$this->requireUid($uid);
		try {
			return $this->contextMapper->findForUser($id, $uid);
		} catch (DoesNotExistException|MultipleObjectsReturnedException $exception) {
			throw new ContextNotFoundException('Context not found.', 0, $exception);
		}
	}

	/** @return TaskbookContext */
	public function toResponse(Context $context): array {
		return [
			'id' => $context->getId(),
			'revision' => $context->getRevision(),
			'title' => $context->getTitle(),
			'icon' => $context->getIcon(),
			'alias' => $context->getAlias(),
			'createdAt' => $context->getCreatedAt()->format('Y-m-d\TH:i:s\Z'),
			'updatedAt' => $context->getUpdatedAt()->format('Y-m-d\TH:i:s\Z'),
		];
	}

	/** @return list<Context> */
	private function ensureDefault(string $uid): array {
		$this->requireUid($uid);
		$contexts = $this->contextMapper->findAllForUser($uid);
		if ($contexts === []) {
			$this->create($uid, 'General', '🗂️', 'g');
			$contexts = $this->contextMapper->findAllForUser($uid);
		}
		$this->defaultId($uid, $contexts);
		return $contexts;
	}

	/** @param list<Context> $contexts */
	private function defaultId(string $uid, array $contexts): int {
		$configured = $this->userConfig->getString($uid, Application::APP_ID, self::DEFAULT_CONTEXT_KEY, '');
		if (preg_match('/^[1-9][0-9]*$/D', $configured) === 1) {
			$id = (int)$configured;
			foreach ($contexts as $context) {
				if ($context->getId() === $id) {
					return $id;
				}
			}
		}
		$id = $contexts[0]->getId();
		$this->userConfig->setString($uid, Application::APP_ID, self::DEFAULT_CONTEXT_KEY, (string)$id);
		return $id;
	}

	private function validateTitle(mixed $title): string {
		if (!is_string($title)) {
			throw new ValidationException('A context title is required.');
		}
		$title = trim($title);
		if ($title === '' || mb_strlen($title) > 120) {
			throw new ValidationException('A context title must contain between 1 and 120 characters.');
		}
		return $title;
	}

	private function validateIcon(mixed $icon): string {
		if (!is_string($icon) || trim($icon) === '' || mb_strlen($icon) > 64 || preg_match(self::EMOJI_PATTERN, $icon) !== 1) {
			throw new ValidationException('Invalid context icon.');
		}
		return $icon;
	}

	private function validateAlias(mixed $alias): string {
		if (!is_string($alias)) {
			throw new ValidationException('A context shortcut is required.');
		}
		$alias = mb_strtolower(trim($alias));
		if (preg_match(self::ALIAS_PATTERN, $alias) !== 1) {
			throw new ValidationException('A context shortcut must contain 1 to 16 letters, numbers, hyphens, or underscores.');
		}
		return $alias;
	}

	private function requireAvailableAlias(string $uid, string $alias, ?int $excludeId = null): void {
		if ($this->contextMapper->findByAliasForUser($alias, $uid, $excludeId) !== null) {
			throw new ValidationException('This context shortcut is already used.');
		}
	}

	private function throwAliasConflict(DbException $exception): never {
		if ($exception->getReason() === DbException::REASON_UNIQUE_CONSTRAINT_VIOLATION) {
			throw new ValidationException('This context shortcut is already used.', 0, $exception);
		}
		throw $exception;
	}

	private function validateId(mixed $value, string $resource): int {
		if (is_string($value) && preg_match('/^[1-9][0-9]*$/D', $value) === 1) {
			$value = (int)$value;
		}
		if (!is_int($value) || $value < 1) {
			throw new ValidationException('Invalid ' . $resource . '.');
		}
		return $value;
	}

	private function requireUid(string $uid): void {
		if ($uid === '') {
			throw new ValidationException('An authenticated user is required.');
		}
	}
}
