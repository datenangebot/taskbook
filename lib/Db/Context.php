<?php

declare(strict_types=1);

namespace OCA\Taskbook\Db;

use DateTimeImmutable;
use LogicException;
use OCP\AppFramework\Db\Entity;
use OCP\DB\Types;

/** @psalm-suppress PropertyNotSetInConstructor The mapper assigns persisted values. */
class Context extends Entity {
	protected ?string $uid = null;
	protected ?int $revision = null;
	protected ?string $title = null;
	protected ?string $icon = null;
	protected ?string $alias = null;
	protected ?DateTimeImmutable $createdAt = null;
	protected ?DateTimeImmutable $updatedAt = null;

	public function __construct() {
		$this->addType('id', Types::BIGINT);
		$this->addType('revision', Types::BIGINT);
		$this->addType('createdAt', Types::DATETIME_IMMUTABLE);
		$this->addType('updatedAt', Types::DATETIME_IMMUTABLE);
	}

	/** @psalm-suppress PossiblyUnusedMethod Called reflectively by QBMapper. */
	public function getUid(): string {
		return $this->uid ?? '';
	}

	public function setUid(string $uid): void {
		$this->setter('uid', [$uid]);
	}

	public function getRevision(): int {
		return $this->revision ?? 1;
	}

	public function setRevision(int $revision): void {
		$this->setter('revision', [$revision]);
	}

	public function getTitle(): string {
		return $this->title ?? '';
	}

	public function setTitle(string $title): void {
		$this->setter('title', [$title]);
	}

	public function getIcon(): string {
		return $this->icon ?? '';
	}

	public function setIcon(string $icon): void {
		$this->setter('icon', [$icon]);
	}

	public function getAlias(): ?string {
		return $this->alias;
	}

	public function setAlias(?string $alias): void {
		$this->setter('alias', [$alias]);
	}

	public function getCreatedAt(): DateTimeImmutable {
		if ($this->createdAt === null) {
			throw new LogicException('createdAt has not been set.');
		}

		return $this->createdAt;
	}

	public function setCreatedAt(DateTimeImmutable $createdAt): void {
		$this->setter('createdAt', [$createdAt]);
	}

	public function getUpdatedAt(): DateTimeImmutable {
		if ($this->updatedAt === null) {
			throw new LogicException('updatedAt has not been set.');
		}

		return $this->updatedAt;
	}

	public function setUpdatedAt(DateTimeImmutable $updatedAt): void {
		$this->setter('updatedAt', [$updatedAt]);
	}
}
